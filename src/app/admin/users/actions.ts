"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { canManageCohorts, isAdmin } from "@/lib/permissions";
import { firstIssue, type FormResult } from "./_lib/form-result";

const changeRoleSchema = z.object({
  userId: z.string().min(1).max(64),
  role: z.enum(["ADMIN", "TEACHER", "STUDENT"], { error: "Rôle invalide." }),
});

/** Changement de rôle (admin uniquement) — un admin ne peut pas se retirer lui-même le rôle ADMIN */
export async function changeRole(userId: string, _prev: FormResult, formData: FormData): Promise<FormResult> {
  const user = await requireUser();
  const parsed = changeRoleSchema.safeParse({ userId, role: formData.get("role") });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error.issues) };
  if (!isAdmin(user)) return { ok: false, error: "Action réservée aux administrateurs." };

  if (parsed.data.userId === user.id && parsed.data.role !== "ADMIN") {
    return { ok: false, error: "Vous ne pouvez pas retirer votre propre rôle d'administrateur." };
  }

  const target = await db.user.findUnique({ where: { id: parsed.data.userId }, select: { id: true } });
  if (!target) return { ok: false, error: "Utilisateur introuvable." };

  await db.user.update({ where: { id: target.id }, data: { role: parsed.data.role } });
  revalidatePath("/admin/users");
  return { ok: true, message: "Rôle mis à jour." };
}

const bulkCohortSchema = z.object({
  cohortId: z.string().min(1, "Choisissez une promo.").max(64),
  userIds: z
    .array(z.string().min(1).max(64))
    .min(1, "Cochez au moins un utilisateur.")
    .max(200, "200 utilisateurs au maximum à la fois."),
});

/** Ajout groupé des utilisateurs cochés à une promo (les membres existants sont ignorés) */
export async function addUsersToCohort(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const user = await requireUser();
  const parsed = bulkCohortSchema.safeParse({
    cohortId: formData.get("cohortId") ?? "",
    userIds: [...new Set(formData.getAll("userIds").map(String))],
  });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error.issues) };
  if (!canManageCohorts(user)) return { ok: false, error: "Action réservée aux administrateurs." };

  const cohort = await db.cohort.findUnique({ where: { id: parsed.data.cohortId }, select: { id: true, name: true } });
  if (!cohort) return { ok: false, error: "Promo introuvable." };
  const users = await db.user.findMany({ where: { id: { in: parsed.data.userIds } }, select: { id: true } });
  if (users.length === 0) return { ok: false, error: "Aucun utilisateur valide sélectionné." };

  const { count } = await db.cohortMember.createMany({
    data: users.map((u) => ({ cohortId: cohort.id, userId: u.id })),
    skipDuplicates: true,
  });
  revalidatePath("/admin/users");
  revalidatePath("/admin/cohorts");
  revalidatePath(`/admin/cohorts/${cohort.id}`);

  const already = users.length - count;
  const parts = [`${count} ajouté${count > 1 ? "s" : ""} à « ${cohort.name} »`];
  if (already > 0) parts.push(`${already} déjà membre${already > 1 ? "s" : ""}`);
  return { ok: true, message: `${parts.join(", ")}.` };
}
