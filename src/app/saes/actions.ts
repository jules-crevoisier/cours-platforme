"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireUser, type CurrentUser } from "@/lib/session";
import { canAnnounce, canCreateSae, canDeleteSae, canEditCourse, canManageSae } from "@/lib/permissions";
import { editorContentSchema } from "@/lib/content";
import { notify } from "@/lib/notify";
import { MMI_CRITICAL_LEARNINGS, MMI_SAE_TEMPLATES } from "@/data/referentiel-mmi";
import type { SaveResult } from "@/components/editor";
import { addParisDays } from "./_lib/dates";
import type { FormState } from "./_lib/form-state";
import { nextGroupNames, parseEmailList, splitIntoGroups } from "./_lib/group-tools";
import {
  FORBIDDEN,
  GENERIC_ERROR,
  NOT_FOUND_SAE,
  checkbox,
  email,
  firstIssue,
  id,
  intInRange,
  isUniqueViolation,
  loadSae,
  optionalDate,
  optionalId,
  optionalText,
  read,
  requiredText,
  revalidateSae,
  saeAccessSelect,
  saeAudienceIds,
  saeShortName,
} from "./_lib/action-utils";

// ─────────────────────────────────────────────────────────────
// Helpers (non exportés : un fichier "use server" n'exporte que des actions)
// ─────────────────────────────────────────────────────────────

const direction = z.enum(["up", "down"], { error: "Direction invalide" });

const semester = z.preprocess(
  (v) => (v === "" || v === undefined ? undefined : v),
  z.coerce
    .number({ error: "Semestre invalide" })
    .int("Semestre invalide")
    .min(1, "Le semestre va de 1 à 6")
    .max(6, "Le semestre va de 1 à 6")
    .optional(),
);

const saeFieldsObject = z.object({
  code: optionalText("Code", 40),
  title: requiredText("Titre", 190),
  semester,
  competences: optionalText("Compétences", 2000),
  startsAt: optionalDate,
  endsAt: optionalDate,
  courseId: optionalId,
  cohortId: optionalId,
});

const datesInOrder = (d: { startsAt?: Date; endsAt?: Date }) => !d.startsAt || !d.endsAt || d.endsAt >= d.startsAt;
const DATES_ERROR = { message: "La date de fin doit être postérieure à la date de début", path: ["endsAt"] };

const SAE_FIELD_KEYS = ["code", "title", "semester", "competences", "startsAt", "endsAt", "courseId", "cohortId"] as const;

async function userCanLinkCourse(user: CurrentUser, courseId: string) {
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { ownerId: true, published: true, editors: { select: { id: true } } },
  });
  return !!course && canEditCourse(user, course);
}

async function cohortExists(cohortId: string) {
  return !!(await db.cohort.findUnique({ where: { id: cohortId }, select: { id: true } }));
}

/** Réordonne une liste (par index) en échangeant l'élément avec son voisin */
function swapped<T extends { id: string }>(items: T[], itemId: string, dir: "up" | "down"): T[] | null {
  const index = items.findIndex((i) => i.id === itemId);
  const target = dir === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= items.length) return null;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** « a, b, c … et 4 autres » */
function listPreview(items: string[], max = 15) {
  if (items.length <= max) return items.join(", ");
  return `${items.slice(0, max).join(", ")} … et ${items.length - max} autres`;
}

const plural = (n: number, singular: string, pluralForm = `${singular}s`) => `${n} ${n > 1 ? pluralForm : singular}`;

// ─────────────────────────────────────────────────────────────
// SAÉ : création (éventuellement depuis un modèle national), infos, publication, sujet, suppression
// ─────────────────────────────────────────────────────────────

const OFFICIAL_AC_LABELS = new Map(MMI_CRITICAL_LEARNINGS.map((l) => [l.code, l.label]));

/** Critères « un par AC du modèle », rattachés au référentiel en base quand l'AC y existe */
async function templateCriteria(acs: readonly string[]) {
  if (acs.length === 0) return [];
  const learnings = await db.criticalLearning.findMany({
    where: { code: { in: [...acs] } },
    select: { id: true, code: true, label: true },
  });
  return acs.map((code, position) => {
    const learning = learnings.find((l) => l.code === code);
    return {
      label: (learning?.label ?? OFFICIAL_AC_LABELS.get(code) ?? code).slice(0, 190),
      acCode: code,
      learningId: learning?.id ?? null,
      position,
    };
  });
}

export async function createSae(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!canCreateSae(user)) return FORBIDDEN;

  const parsed = saeFieldsObject
    .extend({ templateCode: optionalText("Modèle", 40) })
    .refine(datesInOrder, DATES_ERROR)
    .safeParse(read(formData, [...SAE_FIELD_KEYS, "templateCode"]));
  if (!parsed.success) return firstIssue(parsed.error);
  const data = parsed.data;

  const template = data.templateCode ? MMI_SAE_TEMPLATES.find((t) => t.code === data.templateCode) : undefined;
  if (data.templateCode && !template) return { ok: false, error: "Modèle de SAÉ inconnu." };

  if (data.courseId && !(await userCanLinkCourse(user, data.courseId))) {
    return { ok: false, error: "Vous ne pouvez pas lier ce cours." };
  }
  if (data.cohortId && !(await cohortExists(data.cohortId))) return { ok: false, error: "Promo introuvable." };

  let saeId: string;
  try {
    const criteria = template ? await templateCriteria(template.acs) : [];
    const sae = await db.sae.create({
      data: {
        code: data.code ?? template?.code ?? null,
        title: data.title,
        semester: data.semester ?? template?.semester ?? null,
        competences: data.competences,
        startsAt: data.startsAt ?? null,
        endsAt: data.endsAt ?? null,
        courseId: data.courseId,
        cohortId: data.cohortId,
        ownerId: user.id,
        // Modèle national : un jalon « Rendu final » (sans date) avec un critère par AC du programme
        milestones: template
          ? { create: [{ title: "Rendu final", position: 0, criteria: { create: criteria } }] }
          : undefined,
      },
      select: { id: true },
    });
    saeId = sae.id;
  } catch {
    return GENERIC_ERROR;
  }

  revalidatePath("/saes");
  revalidatePath("/");
  redirect(`/saes/${saeId}/manage`);
}

export async function updateSaeSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = saeFieldsObject
    .extend({ saeId: id, published: checkbox })
    .refine(datesInOrder, DATES_ERROR)
    .safeParse(read(formData, [...SAE_FIELD_KEYS, "saeId", "published"]));
  if (!parsed.success) return firstIssue(parsed.error);
  const data = parsed.data;

  const sae = await loadSae(data.saeId);
  if (!sae) return NOT_FOUND_SAE;
  if (!canManageSae(user, sae)) return FORBIDDEN;

  // Changer de cours lié exige de pouvoir éditer le nouveau cours
  if (data.courseId && data.courseId !== sae.courseId && !(await userCanLinkCourse(user, data.courseId))) {
    return { ok: false, error: "Vous ne pouvez pas lier ce cours." };
  }
  if (data.cohortId && data.cohortId !== sae.cohortId && !(await cohortExists(data.cohortId))) {
    return { ok: false, error: "Promo introuvable." };
  }

  try {
    await db.sae.update({
      where: { id: sae.id },
      data: {
        code: data.code,
        title: data.title,
        semester: data.semester ?? null,
        competences: data.competences,
        startsAt: data.startsAt ?? null,
        endsAt: data.endsAt ?? null,
        courseId: data.courseId,
        cohortId: data.cohortId,
        published: data.published,
      },
    });
  } catch {
    return GENERIC_ERROR;
  }

  revalidateSae(sae.id);
  return { ok: true, message: "Modifications enregistrées." };
}

export async function setSaePublished(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = z
    .object({ saeId: id, published: z.enum(["true", "false"], { error: "Valeur invalide" }) })
    .safeParse(read(formData, ["saeId", "published"]));
  if (!parsed.success) return firstIssue(parsed.error);

  const sae = await loadSae(parsed.data.saeId);
  if (!sae) return NOT_FOUND_SAE;
  if (!canManageSae(user, sae)) return FORBIDDEN;

  const published = parsed.data.published === "true";
  try {
    await db.sae.update({ where: { id: sae.id }, data: { published } });
  } catch {
    return GENERIC_ERROR;
  }

  revalidateSae(sae.id);
  return { ok: true, message: published ? "SAÉ publiée." : "SAÉ repassée en brouillon." };
}

/** Action de l'éditeur de sujet : `onSave={saveSaeContent.bind(null, sae.id)}` */
export async function saveSaeContent(saeId: string, content: unknown, markdown: string): Promise<SaveResult> {
  const user = await requireUser();

  const parsedId = id.safeParse(saeId);
  const parsed = editorContentSchema.safeParse({ content, markdown });
  if (!parsedId.success || !parsed.success) return { ok: false, error: "Contenu invalide." };

  const sae = await loadSae(parsedId.data);
  if (!sae) return NOT_FOUND_SAE;
  if (!canManageSae(user, sae)) return FORBIDDEN;

  try {
    await db.sae.update({
      where: { id: sae.id },
      data: {
        content: parsed.data.content as Prisma.InputJsonValue,
        markdown: parsed.data.markdown,
      },
    });
  } catch {
    return GENERIC_ERROR;
  }

  revalidatePath(`/saes/${sae.id}`);
  return { ok: true };
}

/** Suppression définitive : propriétaire ou administrateur uniquement */
export async function deleteSae(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = z.object({ saeId: id }).safeParse(read(formData, ["saeId"]));
  if (!parsed.success) return firstIssue(parsed.error);

  const sae = await loadSae(parsed.data.saeId);
  if (!sae) return NOT_FOUND_SAE;
  if (!canDeleteSae(user, sae)) return FORBIDDEN;

  try {
    await db.sae.delete({ where: { id: sae.id } });
  } catch {
    return GENERIC_ERROR;
  }

  revalidatePath("/saes", "layout");
  revalidatePath("/");
  redirect("/saes");
}

/**
 * Reconduction : copie la SAÉ (sujet, cours lié, équipe, jalons + critères) en brouillon,
 * avec les dates décalées de N semaines. Ni groupes, ni auto-évaluations, ni annonces, ni créneaux.
 */
export async function duplicateSae(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = z
    .object({ saeId: id, weeks: intInRange("Décalage", -260, 260) })
    .safeParse(read(formData, ["saeId", "weeks"]));
  if (!parsed.success) return firstIssue(parsed.error);

  const source = await db.sae.findUnique({
    where: { id: parsed.data.saeId },
    select: {
      ...saeAccessSelect,
      semester: true,
      competences: true,
      content: true,
      markdown: true,
      startsAt: true,
      endsAt: true,
      milestones: {
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        take: 200,
        select: {
          title: true,
          description: true,
          dueAt: true,
          requiresDepositUrl: true,
          peerReviewEnabled: true,
          criteria: {
            orderBy: [{ position: "asc" }, { id: "asc" }],
            take: 200,
            select: { label: true, description: true, acCode: true, learningId: true },
          },
        },
      },
    },
  });
  if (!source) return NOT_FOUND_SAE;
  if (!canCreateSae(user) || !canManageSae(user, source)) return FORBIDDEN;

  const days = parsed.data.weeks * 7;
  const shift = (d: Date | null) => (d ? addParisDays(d, days) : null);
  const suffix = " (copie)";
  // L'équipe d'origine (responsable compris) suit la copie ; la personne qui duplique en devient responsable
  const teacherIds = [...new Set([source.ownerId, ...source.teachers.map((t) => t.id)])].filter((t) => t !== user.id);

  let newId: string;
  try {
    const copy = await db.sae.create({
      data: {
        code: source.code,
        title: `${source.title.slice(0, 190 - suffix.length)}${suffix}`,
        semester: source.semester,
        competences: source.competences,
        content: source.content === null ? Prisma.DbNull : (source.content as Prisma.InputJsonValue),
        markdown: source.markdown,
        startsAt: shift(source.startsAt),
        endsAt: shift(source.endsAt),
        published: false,
        courseId: source.courseId,
        ownerId: user.id,
        sourceSaeId: source.id,
        teachers: teacherIds.length > 0 ? { connect: teacherIds.map((t) => ({ id: t })) } : undefined,
        milestones: {
          create: source.milestones.map((m, position) => ({
            title: m.title,
            description: m.description,
            dueAt: shift(m.dueAt),
            requiresDepositUrl: m.requiresDepositUrl,
            peerReviewEnabled: m.peerReviewEnabled,
            position,
            criteria: {
              create: m.criteria.map((c, cPosition) => ({
                label: c.label,
                description: c.description,
                acCode: c.acCode,
                learningId: c.learningId,
                position: cPosition,
              })),
            },
          })),
        },
      },
      select: { id: true },
    });
    newId = copy.id;
  } catch {
    return GENERIC_ERROR;
  }

  revalidatePath("/saes");
  revalidatePath("/");
  redirect(`/saes/${newId}/manage`);
}

// ─────────────────────────────────────────────────────────────
// Équipe pédagogique
// ─────────────────────────────────────────────────────────────

export async function addSaeTeacher(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = z.object({ saeId: id, email }).safeParse(read(formData, ["saeId", "email"]));
  if (!parsed.success) return firstIssue(parsed.error);

  const sae = await loadSae(parsed.data.saeId);
  if (!sae) return NOT_FOUND_SAE;
  if (!canManageSae(user, sae)) return FORBIDDEN;

  const teacher = await db.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, name: true, role: true },
  });
  if (!teacher) return { ok: false, error: "Aucun compte avec cette adresse e-mail." };
  if (teacher.role !== "TEACHER" && teacher.role !== "ADMIN") {
    return { ok: false, error: "Seul un enseignant ou un administrateur peut être co-enseignant." };
  }
  if (teacher.id === sae.ownerId) return { ok: false, error: "Cette personne est déjà responsable de la SAÉ." };
  if (sae.teachers.some((t) => t.id === teacher.id)) {
    return { ok: false, error: "Cette personne fait déjà partie de l'équipe." };
  }

  try {
    await db.sae.update({ where: { id: sae.id }, data: { teachers: { connect: { id: teacher.id } } } });
  } catch {
    return GENERIC_ERROR;
  }

  revalidateSae(sae.id);
  return { ok: true, message: `${teacher.name} ajouté·e à l'équipe.` };
}

export async function removeSaeTeacher(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = z.object({ saeId: id, userId: id }).safeParse(read(formData, ["saeId", "userId"]));
  if (!parsed.success) return firstIssue(parsed.error);

  const sae = await loadSae(parsed.data.saeId);
  if (!sae) return NOT_FOUND_SAE;
  if (!canManageSae(user, sae)) return FORBIDDEN;
  if (!sae.teachers.some((t) => t.id === parsed.data.userId)) {
    return { ok: false, error: "Cette personne ne fait pas partie de l'équipe." };
  }

  try {
    await db.sae.update({
      where: { id: sae.id },
      data: { teachers: { disconnect: { id: parsed.data.userId } } },
    });
  } catch {
    return GENERIC_ERROR;
  }

  revalidateSae(sae.id);
  return { ok: true, message: "Co-enseignant retiré." };
}

// ─────────────────────────────────────────────────────────────
// Annonces de la SAÉ
// ─────────────────────────────────────────────────────────────

export async function createSaeAnnouncement(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = z
    .object({
      saeId: id,
      title: requiredText("Titre", 190),
      body: requiredText("Message", 10_000).transform((v) => v.replace(/\r\n?/g, "\n")),
      pinned: checkbox,
    })
    .safeParse(read(formData, ["saeId", "title", "body", "pinned"]));
  if (!parsed.success) return firstIssue(parsed.error);
  const data = parsed.data;

  const sae = await loadSae(data.saeId);
  if (!sae) return NOT_FOUND_SAE;
  if (!canAnnounce(user, { scope: "SAE", sae })) return FORBIDDEN;

  try {
    await db.announcement.create({
      data: { scope: "SAE", saeId: sae.id, title: data.title, body: data.body, pinned: data.pinned, authorId: user.id },
    });
  } catch {
    return GENERIC_ERROR;
  }

  // Les étudiants ne voient pas une SAÉ en brouillon : inutile de leur envoyer un lien inaccessible
  let message = "Annonce publiée. La SAÉ est en brouillon : les étudiants ne sont pas notifiés.";
  if (sae.published) {
    const audience = (await saeAudienceIds(sae)).filter((uid) => uid !== user.id);
    await notify(
      audience,
      { type: "announcement", title: `${saeShortName(sae)} · ${data.title}`, body: data.body.slice(0, 300), link: `/saes/${sae.id}` },
      user.id,
    );
    message =
      audience.length > 0
        ? `Annonce publiée, ${plural(audience.length, "personne")} ${audience.length > 1 ? "notifiées" : "notifiée"}.`
        : "Annonce publiée (aucun étudiant à notifier pour l'instant).";
  }

  revalidateSae(sae.id);
  return { ok: true, message };
}

export async function deleteSaeAnnouncement(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = z.object({ announcementId: id }).safeParse(read(formData, ["announcementId"]));
  if (!parsed.success) return firstIssue(parsed.error);

  const announcement = await db.announcement.findUnique({
    where: { id: parsed.data.announcementId },
    select: { id: true, scope: true, sae: { select: saeAccessSelect } },
  });
  if (!announcement || announcement.scope !== "SAE" || !announcement.sae) {
    return { ok: false, error: "Annonce introuvable." };
  }
  if (!canAnnounce(user, { scope: "SAE", sae: announcement.sae })) return FORBIDDEN;

  try {
    await db.announcement.delete({ where: { id: announcement.id } });
  } catch {
    return GENERIC_ERROR;
  }

  revalidateSae(announcement.sae.id);
  return { ok: true, message: "Annonce supprimée." };
}

// ─────────────────────────────────────────────────────────────
// Jalons
// ─────────────────────────────────────────────────────────────

const milestoneFieldsSchema = z.object({
  title: requiredText("Titre", 190),
  description: optionalText("Description", 5000),
  dueAt: optionalDate,
  requiresDepositUrl: checkbox,
  peerReviewEnabled: checkbox,
});

const MILESTONE_FIELD_KEYS = ["title", "description", "dueAt", "requiresDepositUrl", "peerReviewEnabled"] as const;

function loadMilestone(milestoneId: string) {
  return db.milestone.findUnique({
    where: { id: milestoneId },
    select: { id: true, saeId: true, sae: { select: saeAccessSelect } },
  });
}

export async function createMilestone(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = milestoneFieldsSchema
    .extend({ saeId: id })
    .safeParse(read(formData, [...MILESTONE_FIELD_KEYS, "saeId"]));
  if (!parsed.success) return firstIssue(parsed.error);
  const data = parsed.data;

  const sae = await loadSae(data.saeId);
  if (!sae) return NOT_FOUND_SAE;
  if (!canManageSae(user, sae)) return FORBIDDEN;

  try {
    const last = await db.milestone.aggregate({ where: { saeId: sae.id }, _max: { position: true } });
    await db.milestone.create({
      data: {
        saeId: sae.id,
        title: data.title,
        description: data.description,
        dueAt: data.dueAt ?? null,
        requiresDepositUrl: data.requiresDepositUrl,
        peerReviewEnabled: data.peerReviewEnabled,
        position: (last._max.position ?? -1) + 1,
      },
    });
  } catch {
    return GENERIC_ERROR;
  }

  revalidateSae(sae.id);
  return { ok: true, message: "Jalon ajouté." };
}

export async function updateMilestone(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = milestoneFieldsSchema
    .extend({ milestoneId: id })
    .safeParse(read(formData, [...MILESTONE_FIELD_KEYS, "milestoneId"]));
  if (!parsed.success) return firstIssue(parsed.error);
  const data = parsed.data;

  const milestone = await loadMilestone(data.milestoneId);
  if (!milestone) return { ok: false, error: "Jalon introuvable." };
  if (!canManageSae(user, milestone.sae)) return FORBIDDEN;

  try {
    await db.milestone.update({
      where: { id: milestone.id },
      data: {
        title: data.title,
        description: data.description,
        dueAt: data.dueAt ?? null,
        requiresDepositUrl: data.requiresDepositUrl,
        peerReviewEnabled: data.peerReviewEnabled,
      },
    });
  } catch {
    return GENERIC_ERROR;
  }

  revalidateSae(milestone.saeId);
  return { ok: true, message: "Jalon enregistré." };
}

/** Supprime le jalon, ses critères et les auto-évaluations associées (cascade) */
export async function deleteMilestone(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = z.object({ milestoneId: id }).safeParse(read(formData, ["milestoneId"]));
  if (!parsed.success) return firstIssue(parsed.error);

  const milestone = await loadMilestone(parsed.data.milestoneId);
  if (!milestone) return { ok: false, error: "Jalon introuvable." };
  if (!canManageSae(user, milestone.sae)) return FORBIDDEN;

  try {
    await db.milestone.delete({ where: { id: milestone.id } });
  } catch {
    return GENERIC_ERROR;
  }

  revalidateSae(milestone.saeId);
  return { ok: true, message: "Jalon supprimé." };
}

export async function moveMilestone(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = z
    .object({ milestoneId: id, direction })
    .safeParse(read(formData, ["milestoneId", "direction"]));
  if (!parsed.success) return firstIssue(parsed.error);

  const milestone = await loadMilestone(parsed.data.milestoneId);
  if (!milestone) return { ok: false, error: "Jalon introuvable." };
  if (!canManageSae(user, milestone.sae)) return FORBIDDEN;

  try {
    const siblings = await db.milestone.findMany({
      where: { saeId: milestone.saeId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { id: true },
      take: 500,
    });
    const next = swapped(siblings, milestone.id, parsed.data.direction);
    if (next) {
      await db.$transaction(
        next.map((m, position) => db.milestone.update({ where: { id: m.id }, data: { position } })),
      );
    }
  } catch {
    return GENERIC_ERROR;
  }

  revalidateSae(milestone.saeId);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Critères (apprentissages critiques)
// ─────────────────────────────────────────────────────────────

const criterionFieldsSchema = z.object({
  // Facultatif quand un AC est choisi : son libellé officiel sert alors d'intitulé
  label: optionalText("Intitulé", 190),
  description: optionalText("Description", 3000),
  acCode: z
    .string()
    .trim()
    .max(30, "Code AC : 30 caractères maximum")
    .optional()
    .transform((v) => (v ? v.toUpperCase() : null)),
  learningId: optionalId,
});

const CRITERION_FIELD_KEYS = ["label", "description", "acCode", "learningId"] as const;

type CriterionInput = z.infer<typeof criterionFieldsSchema>;

/**
 * Rattachement au référentiel : l'AC choisi fixe `learningId` et `acCode` (toujours synchronisés).
 * Sans AC choisi, un code libre qui correspond à un AC du référentiel est rattaché automatiquement.
 */
async function resolveCriterion(
  data: CriterionInput,
): Promise<
  { ok: true; label: string; acCode: string | null; learningId: string | null } | { ok: false; error: string }
> {
  if (data.learningId) {
    const learning = await db.criticalLearning.findUnique({
      where: { id: data.learningId },
      select: { id: true, code: true, label: true },
    });
    if (!learning) return { ok: false, error: "Apprentissage critique introuvable." };
    return { ok: true, label: data.label ?? learning.label.slice(0, 190), acCode: learning.code, learningId: learning.id };
  }
  if (!data.label) return { ok: false, error: "Intitulé requis (ou choisissez un apprentissage critique)." };
  const linked = data.acCode
    ? await db.criticalLearning.findUnique({ where: { code: data.acCode }, select: { id: true } })
    : null;
  return { ok: true, label: data.label, acCode: data.acCode, learningId: linked?.id ?? null };
}

function loadCriterion(criterionId: string) {
  return db.criterion.findUnique({
    where: { id: criterionId },
    select: {
      id: true,
      milestoneId: true,
      milestone: { select: { saeId: true, sae: { select: saeAccessSelect } } },
    },
  });
}

export async function createCriterion(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = criterionFieldsSchema
    .extend({ milestoneId: id })
    .safeParse(read(formData, [...CRITERION_FIELD_KEYS, "milestoneId"]));
  if (!parsed.success) return firstIssue(parsed.error);
  const data = parsed.data;

  const milestone = await loadMilestone(data.milestoneId);
  if (!milestone) return { ok: false, error: "Jalon introuvable." };
  if (!canManageSae(user, milestone.sae)) return FORBIDDEN;

  const resolved = await resolveCriterion(data);
  if (!resolved.ok) return resolved;

  try {
    const last = await db.criterion.aggregate({
      where: { milestoneId: milestone.id },
      _max: { position: true },
    });
    await db.criterion.create({
      data: {
        milestoneId: milestone.id,
        label: resolved.label,
        description: data.description,
        acCode: resolved.acCode,
        learningId: resolved.learningId,
        position: (last._max.position ?? -1) + 1,
      },
    });
  } catch {
    return GENERIC_ERROR;
  }

  revalidateSae(milestone.saeId);
  return { ok: true, message: "Critère ajouté." };
}

export async function updateCriterion(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = criterionFieldsSchema
    .extend({ criterionId: id })
    .safeParse(read(formData, [...CRITERION_FIELD_KEYS, "criterionId"]));
  if (!parsed.success) return firstIssue(parsed.error);
  const data = parsed.data;

  const criterion = await loadCriterion(data.criterionId);
  if (!criterion) return { ok: false, error: "Critère introuvable." };
  if (!canManageSae(user, criterion.milestone.sae)) return FORBIDDEN;

  const resolved = await resolveCriterion(data);
  if (!resolved.ok) return resolved;

  try {
    await db.criterion.update({
      where: { id: criterion.id },
      data: {
        label: resolved.label,
        description: data.description,
        acCode: resolved.acCode,
        learningId: resolved.learningId,
      },
    });
  } catch {
    return GENERIC_ERROR;
  }

  revalidateSae(criterion.milestone.saeId);
  return { ok: true, message: "Critère enregistré." };
}

/** Supprime le critère et les positionnements des étudiants sur ce critère (cascade) */
export async function deleteCriterion(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = z.object({ criterionId: id }).safeParse(read(formData, ["criterionId"]));
  if (!parsed.success) return firstIssue(parsed.error);

  const criterion = await loadCriterion(parsed.data.criterionId);
  if (!criterion) return { ok: false, error: "Critère introuvable." };
  if (!canManageSae(user, criterion.milestone.sae)) return FORBIDDEN;

  try {
    await db.criterion.delete({ where: { id: criterion.id } });
  } catch {
    return GENERIC_ERROR;
  }

  revalidateSae(criterion.milestone.saeId);
  return { ok: true, message: "Critère supprimé." };
}

export async function moveCriterion(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = z
    .object({ criterionId: id, direction })
    .safeParse(read(formData, ["criterionId", "direction"]));
  if (!parsed.success) return firstIssue(parsed.error);

  const criterion = await loadCriterion(parsed.data.criterionId);
  if (!criterion) return { ok: false, error: "Critère introuvable." };
  if (!canManageSae(user, criterion.milestone.sae)) return FORBIDDEN;

  try {
    const siblings = await db.criterion.findMany({
      where: { milestoneId: criterion.milestoneId },
      orderBy: [{ position: "asc" }, { id: "asc" }],
      select: { id: true },
      take: 500,
    });
    const next = swapped(siblings, criterion.id, parsed.data.direction);
    if (next) {
      await db.$transaction(
        next.map((c, position) => db.criterion.update({ where: { id: c.id }, data: { position } })),
      );
    }
  } catch {
    return GENERIC_ERROR;
  }

  revalidateSae(criterion.milestone.saeId);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Groupes
// ─────────────────────────────────────────────────────────────

const groupName = requiredText("Nom du groupe", 100);
const DUPLICATE_GROUP = { ok: false, error: "Un groupe porte déjà ce nom dans cette SAÉ." } as const;

function loadGroup(groupId: string) {
  return db.group.findUnique({
    where: { id: groupId },
    select: { id: true, saeId: true, name: true, sae: { select: saeAccessSelect } },
  });
}

export async function createGroup(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = z.object({ saeId: id, name: groupName }).safeParse(read(formData, ["saeId", "name"]));
  if (!parsed.success) return firstIssue(parsed.error);

  const sae = await loadSae(parsed.data.saeId);
  if (!sae) return NOT_FOUND_SAE;
  if (!canManageSae(user, sae)) return FORBIDDEN;

  try {
    await db.group.create({ data: { saeId: sae.id, name: parsed.data.name } });
  } catch (e) {
    return isUniqueViolation(e) ? DUPLICATE_GROUP : GENERIC_ERROR;
  }

  revalidateSae(sae.id);
  return { ok: true, message: "Groupe créé." };
}

export async function renameGroup(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = z.object({ groupId: id, name: groupName }).safeParse(read(formData, ["groupId", "name"]));
  if (!parsed.success) return firstIssue(parsed.error);

  const group = await loadGroup(parsed.data.groupId);
  if (!group) return { ok: false, error: "Groupe introuvable." };
  if (!canManageSae(user, group.sae)) return FORBIDDEN;

  try {
    await db.group.update({ where: { id: group.id }, data: { name: parsed.data.name } });
  } catch (e) {
    return isUniqueViolation(e) ? DUPLICATE_GROUP : GENERIC_ERROR;
  }

  revalidateSae(group.saeId);
  return { ok: true, message: "Groupe renommé." };
}

/** Supprime le groupe et ses URL de dépôt ; les auto-évaluations sont conservées sans groupe */
export async function deleteGroup(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = z.object({ groupId: id }).safeParse(read(formData, ["groupId"]));
  if (!parsed.success) return firstIssue(parsed.error);

  const group = await loadGroup(parsed.data.groupId);
  if (!group) return { ok: false, error: "Groupe introuvable." };
  if (!canManageSae(user, group.sae)) return FORBIDDEN;

  try {
    await db.group.delete({ where: { id: group.id } });
  } catch {
    return GENERIC_ERROR;
  }

  revalidateSae(group.saeId);
  return { ok: true, message: "Groupe supprimé." };
}

/** Un étudiant appartient à au plus un groupe par SAÉ */
export async function addGroupMember(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = z.object({ groupId: id, email }).safeParse(read(formData, ["groupId", "email"]));
  if (!parsed.success) return firstIssue(parsed.error);

  const group = await loadGroup(parsed.data.groupId);
  if (!group) return { ok: false, error: "Groupe introuvable." };
  if (!canManageSae(user, group.sae)) return FORBIDDEN;

  const student = await db.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, name: true, role: true },
  });
  if (!student) return { ok: false, error: "Aucun compte avec cette adresse e-mail." };
  if (student.role !== "STUDENT") return { ok: false, error: "Seul un compte étudiant peut rejoindre un groupe." };

  try {
    const outcome = await db.$transaction(async (tx) => {
      const existing = await tx.groupMember.findFirst({
        where: { userId: student.id, group: { saeId: group.saeId } },
        select: { groupId: true, group: { select: { name: true } } },
      });
      if (existing) return existing.groupId === group.id ? "same" : `other:${existing.group.name}`;
      await tx.groupMember.create({ data: { groupId: group.id, saeId: group.saeId, userId: student.id } });
      return "added";
    });
    if (outcome === "same") return { ok: false, error: `${student.name} est déjà dans ce groupe.` };
    if (outcome.startsWith("other:")) {
      return {
        ok: false,
        error: `${student.name} est déjà dans le groupe « ${outcome.slice("other:".length)} » de cette SAÉ.`,
      };
    }
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, error: `${student.name} est déjà dans un groupe de cette SAÉ.` };
    return GENERIC_ERROR;
  }

  revalidateSae(group.saeId);
  return { ok: true, message: `${student.name} ajouté·e au groupe.` };
}

export async function removeGroupMember(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = z.object({ groupId: id, userId: id }).safeParse(read(formData, ["groupId", "userId"]));
  if (!parsed.success) return firstIssue(parsed.error);

  const group = await loadGroup(parsed.data.groupId);
  if (!group) return { ok: false, error: "Groupe introuvable." };
  if (!canManageSae(user, group.sae)) return FORBIDDEN;

  try {
    const { count } = await db.groupMember.deleteMany({
      where: { groupId: group.id, userId: parsed.data.userId },
    });
    if (count === 0) return { ok: false, error: "Cette personne n'est pas dans ce groupe." };
  } catch {
    return GENERIC_ERROR;
  }

  revalidateSae(group.saeId);
  return { ok: true, message: "Membre retiré." };
}

const MAX_BULK_EMAILS = 300;

/**
 * Ajout en lot : liste d'adresses collée (une par ligne ou séparées par des virgules).
 * Rapporte les adresses inconnues, les comptes non étudiants et les étudiants déjà placés dans un groupe de la SAÉ.
 */
export async function addGroupMembersBulk(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = z
    .object({ groupId: id, emails: requiredText("Liste d'adresses", 30_000) })
    .safeParse(read(formData, ["groupId", "emails"]));
  if (!parsed.success) return firstIssue(parsed.error);

  const group = await loadGroup(parsed.data.groupId);
  if (!group) return { ok: false, error: "Groupe introuvable." };
  if (!canManageSae(user, group.sae)) return FORBIDDEN;

  const { emails, invalid } = parseEmailList(parsed.data.emails);
  if (emails.length === 0) return { ok: false, error: "Aucune adresse e-mail reconnue dans la liste." };
  if (emails.length > MAX_BULK_EMAILS) {
    return { ok: false, error: `${MAX_BULK_EMAILS} adresses maximum par envoi (${emails.length} reçues).` };
  }

  const users = await db.user.findMany({
    where: { email: { in: emails } },
    select: { id: true, name: true, email: true, role: true },
    take: MAX_BULK_EMAILS,
  });
  const known = new Set(users.map((u) => u.email.toLowerCase()));
  const unknown = emails.filter((e) => !known.has(e));
  const notStudents = users.filter((u) => u.role !== "STUDENT");
  const students = users.filter((u) => u.role === "STUDENT");

  let added: string[] = [];
  let alreadyHere: string[] = [];
  let elsewhere: string[] = [];
  try {
    const outcome = await db.$transaction(async (tx) => {
      const existing = await tx.groupMember.findMany({
        where: { userId: { in: students.map((s) => s.id) }, group: { saeId: group.saeId } },
        select: { userId: true, groupId: true, group: { select: { name: true } } },
      });
      const placed = new Map(existing.map((m) => [m.userId, m]));
      const toAdd = students.filter((s) => !placed.has(s.id));
      if (toAdd.length > 0) {
        await tx.groupMember.createMany({
          data: toAdd.map((s) => ({ groupId: group.id, saeId: group.saeId, userId: s.id })),
          skipDuplicates: true,
        });
      }
      return { toAdd, placed };
    });
    added = outcome.toAdd.map((s) => s.name);
    for (const s of students) {
      const m = outcome.placed.get(s.id);
      if (!m) continue;
      if (m.groupId === group.id) alreadyHere.push(s.name);
      else elsewhere.push(`${s.name} (${m.group.name})`);
    }
  } catch {
    return GENERIC_ERROR;
  }
  alreadyHere = alreadyHere.sort((a, b) => a.localeCompare(b, "fr"));
  elsewhere = elsewhere.sort((a, b) => a.localeCompare(b, "fr"));

  const lines = [
    added.length > 0 ? `${plural(added.length, "étudiant·e ajouté·e", "étudiant·es ajouté·es")} à « ${group.name} ».` : "",
    alreadyHere.length > 0 ? `Déjà dans ce groupe : ${listPreview(alreadyHere)}.` : "",
    elsewhere.length > 0 ? `Déjà dans un autre groupe de la SAÉ (non ajouté·es) : ${listPreview(elsewhere)}.` : "",
    unknown.length > 0 ? `Adresses sans compte : ${listPreview(unknown)}.` : "",
    notStudents.length > 0 ? `Comptes non étudiants ignorés : ${listPreview(notStudents.map((u) => u.name))}.` : "",
    invalid.length > 0 ? `Entrées non reconnues : ${listPreview(invalid)}.` : "",
  ].filter(Boolean);

  if (added.length === 0) return { ok: false, error: ["Aucun étudiant ajouté.", ...lines].join("\n") };
  revalidateSae(group.saeId);
  return { ok: true, message: lines.join("\n") };
}

/**
 * Groupes aléatoires à partir des étudiants de la promo liée qui n'ont pas encore de groupe dans cette SAÉ.
 * Tailles équilibrées (au plus N), noms « Groupe n » libres, le tout dans une transaction.
 */
export async function autoCreateGroups(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = z
    .object({ saeId: id, size: intInRange("Taille des groupes", 2, 12) })
    .safeParse(read(formData, ["saeId", "size"]));
  if (!parsed.success) return firstIssue(parsed.error);

  const sae = await loadSae(parsed.data.saeId);
  if (!sae) return NOT_FOUND_SAE;
  if (!canManageSae(user, sae)) return FORBIDDEN;
  const cohortId = sae.cohortId;
  if (!cohortId) return { ok: false, error: "Liez d'abord une promo à la SAÉ (onglet Infos)." };

  let result: { groups: number; students: number };
  try {
    result = await db.$transaction(async (tx) => {
      const candidates = await tx.cohortMember.findMany({
        where: { cohortId, user: { role: "STUDENT", memberships: { none: { group: { saeId: sae.id } } } } },
        select: { userId: true },
        take: 1000,
      });
      if (candidates.length === 0) return { groups: 0, students: 0 };
      const existing = await tx.group.findMany({ where: { saeId: sae.id }, select: { name: true }, take: 1000 });
      const split = splitIntoGroups(
        candidates.map((c) => c.userId),
        parsed.data.size,
      );
      const names = nextGroupNames(
        existing.map((g) => g.name),
        split.length,
      );
      for (const [i, members] of split.entries()) {
        await tx.group.create({
          data: { saeId: sae.id, name: names[i], members: { create: members.map((userId) => ({ userId, saeId: sae.id })) } },
        });
      }
      return { groups: split.length, students: candidates.length };
    }, { timeout: 20_000 });
  } catch (e) {
    return isUniqueViolation(e)
      ? { ok: false, error: "Un groupe a été modifié en même temps. Réessayez." }
      : GENERIC_ERROR;
  }

  if (result.groups === 0) {
    return { ok: false, error: "Tous les étudiants de la promo ont déjà un groupe dans cette SAÉ." };
  }
  revalidateSae(sae.id);
  return {
    ok: true,
    message: `${plural(result.groups, "groupe créé", "groupes créés")} pour ${plural(result.students, "étudiant·e", "étudiant·es")}.`,
  };
}
