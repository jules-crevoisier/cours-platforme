"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/lib/session";
import { canContributeToGroup, canManageSae, canViewSae } from "@/lib/permissions";
import { editorContentSchema } from "@/lib/content";
import { depositUrlSchema, detectProvider } from "@/lib/deposit";
import { checkLink, LINK_STATUS_LABELS, type LinkCheckResult } from "@/lib/link-check";
import { firstIssue, idSchema, type ActionResult } from "@/app/me/portfolio/_lib/shared";

/** Délai minimal entre deux vérifications d'un même lien (bouton « Vérifier ») */
const SINGLE_CHECK_COOLDOWN_MS = 20_000;
/** « Tout vérifier » ignore les liens vérifiés depuis moins de 2 min */
const BULK_CHECK_COOLDOWN_MS = 2 * 60_000;
const BULK_CHECK_MAX = 20;
/** Au-delà, on n'entame plus de nouvelle vérification (réponse raisonnable pour l'utilisateur) */
const BULK_CHECK_BUDGET_MS = 25_000;

/** Groupe + ce qu'il faut pour les règles d'accès */
function loadGroup(groupId: string) {
  return db.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      saeId: true,
      members: { select: { userId: true } },
      sae: { select: { ownerId: true, published: true, teachers: { select: { id: true } } } },
    },
  });
}

function revalidateGroup(saeId: string, groupId: string, milestoneId?: string | null) {
  revalidatePath(`/saes/${saeId}/groups/${groupId}`);
  revalidatePath(`/saes/${saeId}`);
  if (milestoneId) revalidatePath(`/saes/${saeId}/milestones/${milestoneId}`);
}

/** checkLink ne lève pas, mais une vérification ratée ne doit jamais faire échouer l'action */
async function safeCheck(url: string): Promise<LinkCheckResult> {
  try {
    return await checkLink(url);
  } catch {
    return { status: "UNREACHABLE", http: null, note: "Vérification impossible pour le moment." };
  }
}

function saveCheck(linkId: string, result: LinkCheckResult) {
  return db.depositLink.update({
    where: { id: linkId },
    data: {
      checkStatus: result.status,
      checkHttp: result.http,
      checkNote: result.note.slice(0, 191),
      checkedAt: new Date(),
    },
  });
}

/** Enregistrement automatique de l'espace de travail partagé (éditeur) */
export async function saveGroupContent(groupId: string, content: unknown, markdown: string): Promise<ActionResult> {
  const user = await requireUser();
  const id = idSchema.safeParse(groupId);
  const parsed = editorContentSchema.safeParse({ content, markdown });
  if (!id.success || !parsed.success) return { ok: false, error: "Contenu invalide" };

  const group = await loadGroup(id.data);
  if (!group) return { ok: false, error: "Groupe introuvable" };
  if (!canViewSae(user, group.sae) || !canContributeToGroup(user, group, group.sae)) {
    return { ok: false, error: "Vous ne pouvez pas modifier cet espace de travail" };
  }

  await db.group.update({
    where: { id: group.id },
    data: { content: parsed.data.content as Prisma.InputJsonValue, markdown: parsed.data.markdown },
  });
  revalidatePath(`/saes/${group.saeId}/groups/${group.id}`);
  return { ok: true };
}

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((v) => (v === "" ? null : v));

const depositSchema = z.object({
  milestoneId: z
    .string()
    .max(64)
    .transform((v) => (v === "" ? null : v)),
  url: depositUrlSchema,
  label: optionalText(191, "Libellé trop long (191 caractères maximum)"),
});

const MAX_LINKS_PER_GROUP = 50;
const MAX_LINKS_PER_MINUTE = 10;

export async function addDepositLink(
  groupId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const id = idSchema.safeParse(groupId);
  if (!id.success) return { ok: false, error: "Groupe invalide" };

  const parsed = depositSchema.safeParse({
    milestoneId: formData.get("milestoneId") ?? "",
    url: formData.get("url") ?? "",
    label: formData.get("label") ?? "",
  });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error.issues) };

  const group = await loadGroup(id.data);
  if (!group) return { ok: false, error: "Groupe introuvable" };
  if (!canViewSae(user, group.sae) || !canContributeToGroup(user, group, group.sae)) {
    return { ok: false, error: "Vous ne pouvez pas ajouter d'URL de dépôt à ce groupe" };
  }

  const { milestoneId, url, label } = parsed.data;
  if (milestoneId) {
    const milestone = await db.milestone.findFirst({
      where: { id: milestoneId, saeId: group.saeId },
      select: { id: true },
    });
    if (!milestone) return { ok: false, error: "Jalon introuvable pour cette SAÉ" };
  }

  // Anti-abus : chaque ajout déclenche une requête sortante (vérification du lien)
  const [total, recent] = await Promise.all([
    db.depositLink.count({ where: { groupId: group.id } }),
    db.depositLink.count({ where: { addedById: user.id, createdAt: { gt: new Date(Date.now() - 60_000) } } }),
  ]);
  if (total >= MAX_LINKS_PER_GROUP) {
    return { ok: false, error: `Ce groupe a atteint ${MAX_LINKS_PER_GROUP} liens : supprimez les liens obsolètes.` };
  }
  if (recent >= MAX_LINKS_PER_MINUTE) {
    return { ok: false, error: "Trop d'ajouts en une minute : patientez un instant." };
  }

  const link = await db.depositLink.create({
    data: {
      groupId: group.id,
      milestoneId,
      url,
      label,
      provider: detectProvider(url),
      addedById: user.id,
    },
    select: { id: true },
  });

  // Vérification immédiate (non bloquante : le lien reste enregistré quel que soit le résultat)
  const check = await safeCheck(url);
  await saveCheck(link.id, check).catch(() => null);

  revalidateGroup(group.saeId, group.id, milestoneId);
  return {
    ok: true,
    message:
      check.status === "OK"
        ? "URL de dépôt ajoutée — lien accessible."
        : `URL ajoutée, mais à vérifier : ${LINK_STATUS_LABELS[check.status]}. ${check.note}`,
  };
}

export async function deleteDepositLink(linkId: string): Promise<ActionResult> {
  const user = await requireUser();
  const id = idSchema.safeParse(linkId);
  if (!id.success) return { ok: false, error: "Lien invalide" };

  const link = await db.depositLink.findUnique({
    where: { id: id.data },
    select: { id: true, addedById: true, milestoneId: true, groupId: true },
  });
  if (!link) return { ok: false, error: "Lien introuvable (déjà supprimé ?)" };

  const group = await loadGroup(link.groupId);
  if (!group) return { ok: false, error: "Groupe introuvable" };

  const isManager = canManageSae(user, group.sae);
  const isOwnLink = link.addedById === user.id && canContributeToGroup(user, group, group.sae);
  if (!isManager && !isOwnLink) {
    return { ok: false, error: "Vous ne pouvez supprimer que les liens que vous avez ajoutés" };
  }

  await db.depositLink.delete({ where: { id: link.id } });
  revalidateGroup(group.saeId, group.id, link.milestoneId);
  return { ok: true };
}

/** Vérifie un lien de dépôt (membres du groupe et équipe pédagogique) */
export async function checkDepositLink(linkId: string): Promise<ActionResult> {
  const user = await requireUser();
  const id = idSchema.safeParse(linkId);
  if (!id.success) return { ok: false, error: "Lien invalide" };

  const link = await db.depositLink.findUnique({
    where: { id: id.data },
    select: { id: true, url: true, groupId: true, milestoneId: true, checkedAt: true },
  });
  if (!link) return { ok: false, error: "Lien introuvable (supprimé ?)" };

  const group = await loadGroup(link.groupId);
  if (!group) return { ok: false, error: "Groupe introuvable" };
  if (!canViewSae(user, group.sae) || !canContributeToGroup(user, group, group.sae)) {
    return { ok: false, error: "Vous ne pouvez pas vérifier les liens de ce groupe" };
  }

  if (link.checkedAt && Date.now() - link.checkedAt.getTime() < SINGLE_CHECK_COOLDOWN_MS) {
    return { ok: false, error: "Lien vérifié il y a quelques secondes : patientez un instant avant de relancer." };
  }

  const result = await safeCheck(link.url);
  const saved = await saveCheck(link.id, result).catch(() => null);
  if (!saved) return { ok: false, error: "Le lien a été supprimé pendant la vérification." };
  revalidateGroup(group.saeId, group.id, link.milestoneId);
  return { ok: true, message: `${LINK_STATUS_LABELS[result.status]} — ${result.note}` };
}

/** Vérifie tous les liens du groupe, un par un (au plus 20, en ignorant ceux vérifiés depuis moins de 2 min) */
export async function checkAllDepositLinks(groupId: string): Promise<ActionResult> {
  const user = await requireUser();
  const id = idSchema.safeParse(groupId);
  if (!id.success) return { ok: false, error: "Groupe invalide" };

  const group = await loadGroup(id.data);
  if (!group) return { ok: false, error: "Groupe introuvable" };
  if (!canViewSae(user, group.sae) || !canContributeToGroup(user, group, group.sae)) {
    return { ok: false, error: "Vous ne pouvez pas vérifier les liens de ce groupe" };
  }

  const links = await db.depositLink.findMany({
    where: { groupId: group.id },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: { id: true, url: true, checkedAt: true },
  });
  if (links.length === 0) return { ok: false, error: "Aucun lien à vérifier." };

  const now = Date.now();
  const due = links
    .filter((l) => !l.checkedAt || now - l.checkedAt.getTime() >= BULK_CHECK_COOLDOWN_MS)
    // Jamais vérifiés d'abord, puis les plus anciennes vérifications
    .sort((a, b) => (a.checkedAt?.getTime() ?? 0) - (b.checkedAt?.getTime() ?? 0));
  const recent = links.length - due.length;
  if (due.length === 0) {
    return { ok: true, message: "Tous les liens ont été vérifiés il y a moins de 2 minutes." };
  }

  const started = Date.now();
  let checked = 0;
  let problems = 0;
  for (const link of due.slice(0, BULK_CHECK_MAX)) {
    if (Date.now() - started > BULK_CHECK_BUDGET_MS) break;
    const result = await safeCheck(link.url);
    await saveCheck(link.id, result).catch(() => null);
    checked++;
    if (result.status !== "OK") problems++;
  }
  const remaining = due.length - checked;

  revalidateGroup(group.saeId, group.id);
  const parts = [
    `${checked} lien${checked > 1 ? "s" : ""} vérifié${checked > 1 ? "s" : ""}`,
    problems ? `${problems} à corriger` : "tous accessibles",
  ];
  if (recent) parts.push(`${recent} ignoré${recent > 1 ? "s" : ""} (vérifié${recent > 1 ? "s" : ""} il y a moins de 2 min)`);
  if (remaining) parts.push(`${remaining} restant${remaining > 1 ? "s" : ""} : relancez dans un instant`);
  return { ok: true, message: `${parts.join(", ")}.` };
}
