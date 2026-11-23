"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { notify, saeStaffIds } from "@/lib/notify";
import {
  canCommentAssessment,
  canEvaluateAssessment,
  canManageSae,
  canReopenAssessment,
} from "@/lib/permissions";
import { firstIssue, MAX_BODY, type ActionResult } from "@/app/assessments/_lib/shared";
import {
  idSchema,
  optionalBodySchema,
  optionalLevelSchema,
  readKeyedFields,
} from "@/app/assessments/_lib/validation";

const commentSchema = z.object({
  body: z
    .string({ error: "Commentaire vide" })
    .trim()
    .min(1, "Le commentaire est vide")
    .max(MAX_BODY, `Commentaire trop long (${MAX_BODY} caractères maximum)`),
});

const feedbackSchema = z.object({
  items: z
    .array(
      z.object({
        criterionId: idSchema,
        level: optionalLevelSchema,
        comment: optionalBodySchema,
      }),
    )
    .max(200),
  intent: z.enum(["save", "publish"], { error: "Action inconnue" }),
});

/** Auto-évaluation + ce qu'il faut pour les règles d'accès (SAÉ avec responsable et co-enseignants) */
function loadAssessment(assessmentId: string) {
  return db.selfAssessment.findUnique({
    where: { id: assessmentId },
    select: {
      id: true,
      userId: true,
      status: true,
      groupId: true,
      milestoneId: true,
      feedbackPublishedAt: true,
      user: { select: { name: true } },
      group: { select: { members: { select: { userId: true } } } },
      items: { select: { id: true, criterionId: true, teacherLevel: true, teacherComment: true } },
      milestone: {
        select: {
          title: true,
          saeId: true,
          sae: { select: { ownerId: true, published: true, teachers: { select: { id: true } } } },
        },
      },
    },
  });
}

type LoadedAssessment = NonNullable<Awaited<ReturnType<typeof loadAssessment>>>;

function revalidateAssessment(a: LoadedAssessment) {
  const saeId = a.milestone.saeId;
  revalidatePath(`/assessments/${a.id}`);
  revalidatePath(`/saes/${saeId}/milestones/${a.milestoneId}`);
  revalidatePath(`/saes/${saeId}/review`);
  if (a.groupId) revalidatePath(`/saes/${saeId}/groups/${a.groupId}`);
  revalidatePath("/");
}

function excerpt(text: string, max = 160) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

// ── Commentaires ─────────────────────────────────────────────

export async function addComment(
  assessmentId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const id = idSchema.safeParse(assessmentId);
  if (!id.success) return { ok: false, error: "Auto-évaluation invalide" };

  const parsed = commentSchema.safeParse({ body: formData.get("body") });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error.issues) };

  const assessment = await loadAssessment(id.data);
  if (!assessment) return { ok: false, error: "Auto-évaluation introuvable" };
  if (!canCommentAssessment(user, assessment, assessment.milestone.sae)) {
    return { ok: false, error: "Vous ne pouvez pas commenter cette auto-évaluation" };
  }

  await db.comment.create({
    data: { assessmentId: assessment.id, authorId: user.id, body: parsed.data.body },
  });

  // Auteur de l'auto-évaluation + équipe de la SAÉ, sauf l'auteur du commentaire
  const staff = await saeStaffIds(assessment.milestone.saeId);
  await notify(
    [assessment.userId, ...staff],
    {
      type: "comment",
      title: `Nouveau commentaire — ${assessment.milestone.title}`,
      body: `${user.name} sur l'auto-évaluation de ${assessment.user.name} : « ${excerpt(parsed.data.body)} »`,
      link: `/assessments/${assessment.id}`,
    },
    user.id,
  );

  revalidateAssessment(assessment);
  return { ok: true, message: "Commentaire publié" };
}

export async function deleteComment(commentId: string): Promise<ActionResult> {
  const user = await requireUser();
  const id = idSchema.safeParse(commentId);
  if (!id.success) return { ok: false, error: "Commentaire invalide" };

  const comment = await db.comment.findUnique({
    where: { id: id.data },
    select: { id: true, authorId: true, assessmentId: true },
  });
  if (!comment) return { ok: false, error: "Commentaire introuvable (déjà supprimé ?)" };

  const assessment = await loadAssessment(comment.assessmentId);
  if (!assessment) return { ok: false, error: "Auto-évaluation introuvable" };

  const allowed = comment.authorId === user.id || canManageSae(user, assessment.milestone.sae);
  if (!allowed) return { ok: false, error: "Vous ne pouvez supprimer que vos propres commentaires" };

  await db.comment.delete({ where: { id: comment.id } });
  revalidateAssessment(assessment);
  return { ok: true };
}

// ── Réouverture ──────────────────────────────────────────────

export async function reopenAssessment(assessmentId: string): Promise<ActionResult> {
  const user = await requireUser();
  const id = idSchema.safeParse(assessmentId);
  if (!id.success) return { ok: false, error: "Auto-évaluation invalide" };

  const assessment = await loadAssessment(id.data);
  if (!assessment) return { ok: false, error: "Auto-évaluation introuvable" };
  if (!canReopenAssessment(user, assessment.milestone.sae)) {
    return { ok: false, error: "Seule l'équipe pédagogique peut rouvrir une auto-évaluation" };
  }
  if (assessment.status !== "SUBMITTED") return { ok: false, error: "Cette auto-évaluation est déjà un brouillon" };

  await db.selfAssessment.update({
    where: { id: assessment.id },
    data: { status: "DRAFT", submittedAt: null },
  });

  const assessHref = `/saes/${assessment.milestone.saeId}/milestones/${assessment.milestoneId}/assess`;
  await notify(
    [assessment.userId],
    {
      type: "reopen",
      title: `Auto-évaluation rouverte — ${assessment.milestone.title}`,
      body: `${user.name} a rouvert votre auto-évaluation : vous pouvez la modifier puis la soumettre à nouveau.`,
      link: assessHref,
    },
    user.id,
  );

  revalidateAssessment(assessment);
  revalidatePath(assessHref);
  return { ok: true };
}

// ── Positionnement enseignant ─────────────────────────────────

class NotSubmittedError extends Error {}

/**
 * Enregistre les niveaux / commentaires enseignant par critère.
 * intent "save" : ne change pas l'état de publication (brouillon reste brouillon) ;
 * intent "publish" : publie (ou republie) le retour, date + auteur, et notifie l'étudiant·e.
 * Champs : `teacherLevel:<criterionId>` ("" = sans niveau) et `teacherComment:<criterionId>`.
 */
export async function saveTeacherFeedback(
  assessmentId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const id = idSchema.safeParse(assessmentId);
  if (!id.success) return { ok: false, error: "Auto-évaluation invalide" };

  const fields = readKeyedFields(formData, ["teacherLevel", "teacherComment"] as const);
  const parsed = feedbackSchema.safeParse({
    items: [...fields.entries()].map(([criterionId, f]) => ({
      criterionId,
      level: f.teacherLevel ?? "",
      comment: f.teacherComment ?? "",
    })),
    intent: formData.get("intent"),
  });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error.issues) };
  const { items, intent } = parsed.data;

  const assessment = await loadAssessment(id.data);
  if (!assessment) return { ok: false, error: "Auto-évaluation introuvable" };
  if (!canEvaluateAssessment(user, assessment.milestone.sae)) {
    return { ok: false, error: "Seule l'équipe pédagogique de la SAÉ peut positionner l'étudiant·e" };
  }
  if (assessment.status !== "SUBMITTED") {
    return { ok: false, error: "Seule une auto-évaluation soumise peut recevoir un positionnement enseignant" };
  }

  const itemByCriterion = new Map(assessment.items.map((item) => [item.criterionId, item]));
  if (items.some((item) => !itemByCriterion.has(item.criterionId))) {
    return { ok: false, error: "Critère inconnu pour cette auto-évaluation — rechargez la page" };
  }

  // État final de chaque critère (valeurs envoyées, sinon valeurs existantes)
  const sent = new Map(items.map((item) => [item.criterionId, item]));
  const finalItems = assessment.items.map((existing) => {
    const next = sent.get(existing.criterionId);
    return next
      ? { level: next.level, comment: next.comment }
      : { level: existing.teacherLevel, comment: existing.teacherComment };
  });

  const publishing = intent === "publish";
  if (publishing && !finalItems.some((i) => i.level != null || i.comment != null)) {
    return { ok: false, error: "Renseignez au moins un niveau ou un commentaire avant de publier le retour" };
  }

  const changed = items.filter((item) => {
    const existing = itemByCriterion.get(item.criterionId)!;
    return existing.teacherLevel !== item.level || existing.teacherComment !== item.comment;
  });
  const wasPublished = !!assessment.feedbackPublishedAt;

  try {
    await db.$transaction(async (tx) => {
      // L'auto-évaluation a pu être rouverte entre-temps
      const current = await tx.selfAssessment.findUnique({ where: { id: assessment.id }, select: { status: true } });
      if (current?.status !== "SUBMITTED") throw new NotSubmittedError();

      for (const item of changed) {
        await tx.selfAssessmentItem.update({
          where: { id: itemByCriterion.get(item.criterionId)!.id },
          data: { teacherLevel: item.level, teacherComment: item.comment },
        });
      }
      if (publishing) {
        await tx.selfAssessment.update({
          where: { id: assessment.id },
          data: { feedbackPublishedAt: new Date(), feedbackById: user.id },
        });
      }
    });
  } catch (error) {
    if (error instanceof NotSubmittedError) {
      return { ok: false, error: "Cette auto-évaluation a été rouverte : attendez sa nouvelle soumission" };
    }
    console.error("saveTeacherFeedback", error);
    return { ok: false, error: "Enregistrement impossible, réessayez dans un instant" };
  }

  if (publishing) {
    await notify(
      [assessment.userId],
      {
        type: "feedback",
        title: `Retour publié sur ${assessment.milestone.title}`,
        body: wasPublished
          ? `${user.name} a mis à jour son retour sur votre auto-évaluation.`
          : `${user.name} a publié son positionnement sur votre auto-évaluation.`,
        link: `/assessments/${assessment.id}`,
      },
      user.id,
    );
  }

  revalidateAssessment(assessment);
  revalidatePath("/me/competences");
  return {
    ok: true,
    message: publishing
      ? wasPublished
        ? "Retour republié, l'étudiant·e a été notifié·e"
        : "Retour publié, l'étudiant·e a été notifié·e"
      : "Positionnement enregistré",
  };
}

/** Retire la publication : le retour redevient un brouillon invisible pour l'étudiant·e */
export async function unpublishFeedback(assessmentId: string): Promise<ActionResult> {
  const user = await requireUser();
  const id = idSchema.safeParse(assessmentId);
  if (!id.success) return { ok: false, error: "Auto-évaluation invalide" };

  const assessment = await loadAssessment(id.data);
  if (!assessment) return { ok: false, error: "Auto-évaluation introuvable" };
  if (!canEvaluateAssessment(user, assessment.milestone.sae)) {
    return { ok: false, error: "Seule l'équipe pédagogique de la SAÉ peut dépublier ce retour" };
  }
  if (!assessment.feedbackPublishedAt) return { ok: false, error: "Ce retour n'est pas publié" };

  await db.selfAssessment.update({
    where: { id: assessment.id },
    data: { feedbackPublishedAt: null, feedbackById: null },
  });
  revalidateAssessment(assessment);
  revalidatePath("/me/competences");
  return { ok: true, message: "Retour dépublié" };
}
