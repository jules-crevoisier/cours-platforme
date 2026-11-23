import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { assertAllowed, requireUser } from "@/lib/session";
import {
  canCommentAssessment,
  canEditAssessment,
  canEvaluateAssessment,
  canManageSae,
  canReopenAssessment,
  canSeeTeacherFeedback,
  canViewAssessment,
} from "@/lib/permissions";
import {
  averageLevel,
  countSignificantGaps,
  criterionSelect,
  feedbackStatus,
  formatAverage,
  formatDateTime,
  toCriterionView,
} from "@/app/assessments/_lib/shared";
import { AssessmentStatusBadge, EmptyState, PageHeader } from "@/components/ui";
import { CriteriaComparison } from "@/app/assessments/_lib/comparison";
import { ConfirmActionButton } from "@/app/assessments/_lib/confirm-action-button";
import { TeacherFeedbackForm } from "@/app/assessments/_lib/teacher-feedback-form";
import { listMySnippets } from "@/app/assessments/_lib/snippets";
import { addComment, deleteComment, reopenAssessment, saveTeacherFeedback, unpublishFeedback } from "./actions";
import { CommentForm } from "./comment-form";

export const metadata: Metadata = { title: "Auto-évaluation" };

export default async function AssessmentPage({ params }: PageProps<"/assessments/[assessmentId]">) {
  const { assessmentId } = await params;
  const user = await requireUser();

  const assessment = await db.selfAssessment.findUnique({
    where: { id: assessmentId },
    include: {
      user: { select: { id: true, name: true } },
      group: {
        select: {
          id: true,
          name: true,
          members: { select: { userId: true } },
        },
      },
      milestone: {
        include: {
          sae: {
            select: {
              id: true,
              code: true,
              title: true,
              ownerId: true,
              published: true,
              teachers: { select: { id: true } },
            },
          },
          criteria: { orderBy: { position: "asc" }, select: criterionSelect },
        },
      },
      items: true,
      comments: {
        orderBy: { createdAt: "asc" },
        take: 500,
        include: { author: { select: { id: true, name: true, role: true } } },
      },
    },
  });
  if (!assessment) notFound();

  const { milestone } = assessment;
  const { sae } = milestone;
  assertAllowed(canViewAssessment(user, assessment, sae));

  const isManager = canManageSae(user, sae);
  const canEdit = canEditAssessment(user, assessment);
  const canReopen = assessment.status === "SUBMITTED" && canReopenAssessment(user, sae);
  const canComment = canCommentAssessment(user, assessment, sae);
  const canSeeTeacher = canSeeTeacherFeedback(user, assessment, sae);
  const canEvaluate = assessment.status === "SUBMITTED" && canEvaluateAssessment(user, sae);
  const isOwn = assessment.userId === user.id;
  const published = !!assessment.feedbackPublishedAt;
  const status = feedbackStatus(assessment);
  const isAuthor = isOwn && !isManager;

  const snippets = isManager ? await listMySnippets(user) : [];
  const itemByCriterion = new Map(assessment.items.map((item) => [item.criterionId, item]));
  const criteria = milestone.criteria.map((c) => {
    const item = itemByCriterion.get(c.id);
    return {
      ...toCriterionView(c),
      self: item ? { level: item.level, justification: item.justification } : null,
      teacher: item ? { level: item.teacherLevel, comment: item.teacherComment } : null,
      teacherLevel: item?.teacherLevel ?? null,
      teacherComment: item?.teacherComment ?? null,
    };
  });

  const selfAvg = averageLevel(assessment.items.map((i) => i.level));
  const teacherAvg = averageLevel(assessment.items.flatMap((i) => (i.teacherLevel != null ? [i.teacherLevel] : [])));
  const gaps = countSignificantGaps(assessment.items);

  const milestoneHref = `/saes/${sae.id}/milestones/${milestone.id}`;
  const queueHref = `/saes/${sae.id}/review?milestone=${milestone.id}&a=${assessment.id}`;

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        breadcrumbs={[
          { label: "SAÉ", href: "/saes" },
          { label: sae.code ?? sae.title, href: `/saes/${sae.id}` },
          { label: milestone.title, href: milestoneHref },
          { label: "Auto-évaluation" },
        ]}
        title={isOwn ? "Mon auto-évaluation" : `Auto-évaluation de ${assessment.user.name}`}
        meta={
          <>
            <AssessmentStatusBadge status={assessment.status} />
            {assessment.submittedAt && (
              <time dateTime={assessment.submittedAt.toISOString()}>{formatDateTime(assessment.submittedAt)}</time>
            )}
            {assessment.group && (
              <span className="break-words">
                Groupe{" "}
                <Link href={`/saes/${sae.id}/groups/${assessment.group.id}`} className="link">
                  {assessment.group.name}
                </Link>
              </span>
            )}
            {assessment.feedbackPublishedAt && (isManager || isOwn) ? (
              <span>Retour publié le {formatDateTime(assessment.feedbackPublishedAt)}</span>
            ) : isManager && status === "DRAFT" ? (
              <span>Retour en brouillon</span>
            ) : isAuthor && assessment.status === "SUBMITTED" ? (
              <span>Retour non publié</span>
            ) : null}
          </>
        }
        actions={
          (canEdit || canReopen || canEvaluate) && (
            <>
              {canEdit && (
                <Link href={`${milestoneHref}/assess`} className="btn btn-primary">
                  Modifier
                </Link>
              )}
              {canEvaluate && (
                <Link href={queueHref} className="btn">
                  File de correction
                </Link>
              )}
              {canReopen && (
                <ConfirmActionButton
                  action={reopenAssessment.bind(null, assessment.id)}
                  label="Rouvrir"
                  pendingLabel="Réouverture…"
                  confirmMessage="Rouvrir cette auto-évaluation ? L'étudiant·e pourra la modifier puis la soumettre à nouveau, et sera notifié·e."
                />
              )}
            </>
          )
        }
      />

      {canEvaluate ? (
        <section id="positionnement" aria-labelledby="feedback-title" className="flex scroll-mt-4 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="feedback-title" className="text-xl">
              Positionnement
            </h2>
            {published && (
              <ConfirmActionButton
                action={unpublishFeedback.bind(null, assessment.id)}
                label="Dépublier le retour"
                pendingLabel="Dépublication…"
                confirmMessage="Dépublier ce retour ? L'étudiant·e ne verra plus vos niveaux ni vos commentaires jusqu'à la prochaine publication."
              />
            )}
          </div>
          <TeacherFeedbackForm
            action={saveTeacherFeedback.bind(null, assessment.id)}
            criteria={criteria}
            snippets={snippets}
            published={published}
            showJustifications
          />
        </section>
      ) : (
        <section aria-labelledby="criteria-title" className="flex flex-col gap-4">
          <h2 id="criteria-title" className="text-xl">
            Positionnement
          </h2>
          {canSeeTeacher && published && (
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span>
                Moyenne auto <strong>{formatAverage(selfAvg)}</strong>
              </span>
              <span>
                Enseignant <strong>{formatAverage(teacherAvg)}</strong>
              </span>
              {gaps > 0 && (
                <span>
                  {gaps} écart{gaps > 1 ? "s" : ""} important{gaps > 1 ? "s" : ""}
                </span>
              )}
            </p>
          )}
          <CriteriaComparison criteria={criteria} showTeacher={canSeeTeacher} teacherDraft={!published} />
        </section>
      )}

      <section aria-labelledby="reflection-title" className="flex flex-col gap-3">
        <h2 id="reflection-title" className="text-xl">
          Réflexion globale
        </h2>
        {assessment.reflection ? (
          <p className="max-w-prose break-words whitespace-pre-line">{assessment.reflection}</p>
        ) : (
          <p className="text-muted">Aucune réflexion rédigée.</p>
        )}
      </section>

      <section aria-labelledby="comments-title" className="flex flex-col gap-4">
        <h2 id="comments-title" className="text-xl">
          Commentaires
        </h2>
        {assessment.comments.length === 0 ? (
          <EmptyState>Aucun commentaire.</EmptyState>
        ) : (
          <ol className="flex flex-col divide-y divide-line">
            {assessment.comments.map((comment) => {
              const authorIsTeacher = canManageSae(comment.author, sae);
              const canDelete = comment.author.id === user.id || isManager;
              return (
                <li key={comment.id} className="flex flex-col gap-2 py-4 first:pt-0">
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                    <span className="font-semibold break-words">{comment.author.name}</span>
                    {authorIsTeacher && <span className="text-sm text-muted">Enseignant</span>}
                    <time dateTime={comment.createdAt.toISOString()} className="text-sm text-muted">
                      {formatDateTime(comment.createdAt)}
                    </time>
                  </div>
                  <p className="break-words whitespace-pre-line">{comment.body}</p>
                  {canDelete && (
                    <div>
                      <ConfirmActionButton
                        action={deleteComment.bind(null, comment.id)}
                        label="Supprimer"
                        pendingLabel="Suppression…"
                        confirmMessage="Supprimer ce commentaire ?"
                        ariaLabel={`Supprimer le commentaire de ${comment.author.name}`}
                        variant="danger"
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        {canComment && (
          <CommentForm action={addComment.bind(null, assessment.id)} snippets={isManager ? snippets : undefined} />
        )}
      </section>
    </div>
  );
}
