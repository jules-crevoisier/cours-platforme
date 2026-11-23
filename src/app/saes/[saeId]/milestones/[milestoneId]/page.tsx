import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { assertAllowed, requireUser } from "@/lib/session";
import {
  canEvaluateAssessment,
  canManageSae,
  canSeePeerReviews,
  canSeeTeacherFeedback,
  canViewSae,
} from "@/lib/permissions";
import {
  averageLevel,
  countSignificantGaps,
  criterionSelect,
  formatAverage,
  formatDateTime,
  isFeedbackReady,
  isPeerReviewOpen,
  peerReviewClosesAt,
  toCriterionView,
} from "@/app/assessments/_lib/shared";
import { CriterionHeading } from "@/app/assessments/_lib/ui";
import { AssessmentStatusBadge, DeadlineChip, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { ConfirmActionButton } from "@/app/assessments/_lib/confirm-action-button";
import { publishReadyFeedback, savePeerReviews } from "./actions";
import { FollowUp } from "./_components/follow-up";
import { PeerReviewForm } from "./_components/peer-review-form";
import { PeerReviewOverview } from "./_components/peer-review-overview";

export const metadata: Metadata = { title: "Jalon" };

export default async function MilestonePage({ params }: PageProps<"/saes/[saeId]/milestones/[milestoneId]">) {
  const { saeId, milestoneId } = await params;
  const user = await requireUser();

  const milestone = await db.milestone.findUnique({
    where: { id: milestoneId },
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
  });
  if (!milestone || milestone.saeId !== saeId) notFound();

  const { sae } = milestone;
  assertAllowed(canViewSae(user, sae));
  const isManager = canManageSae(user, sae);
  const canEvaluate = canEvaluateAssessment(user, sae);
  const criteria = milestone.criteria.map(toCriterionView);

  // ── Côté étudiant : mon groupe, mon auto-évaluation, mes évaluations de pairs ──
  const myGroup = await db.group.findFirst({
    where: { saeId: sae.id, members: { some: { userId: user.id } } },
    select: {
      id: true,
      name: true,
      members: { orderBy: { joinedAt: "asc" }, select: { userId: true, user: { select: { name: true } } } },
      _count: { select: { depositLinks: { where: { milestoneId: milestone.id } } } },
    },
  });
  const myAssessment = myGroup
    ? await db.selfAssessment.findUnique({
        where: { milestoneId_userId: { milestoneId: milestone.id, userId: user.id } },
        select: {
          id: true,
          userId: true,
          status: true,
          submittedAt: true,
          feedbackPublishedAt: true,
          items: { select: { level: true, teacherLevel: true } },
        },
      })
    : null;
  const showMyFeedback = !!myAssessment?.feedbackPublishedAt && canSeeTeacherFeedback(user, myAssessment, sae);
  const myItems = myAssessment?.items ?? [];
  const mySelfAvg = averageLevel(myItems.map((i) => i.level));
  const myTeacherAvg = averageLevel(myItems.flatMap((i) => (i.teacherLevel != null ? [i.teacherLevel] : [])));
  const myGaps = countSignificantGaps(myItems);

  const peerEnabled = milestone.peerReviewEnabled;
  const peerOpen = isPeerReviewOpen(milestone.dueAt);
  const peerClosesAt = peerReviewClosesAt(milestone.dueAt);
  const teammates =
    myGroup?.members.filter((m) => m.userId !== user.id).map((m) => ({ id: m.userId, name: m.user.name })) ?? [];
  const myPeerReviews =
    peerEnabled && myGroup && teammates.length > 0
      ? await db.peerReview.findMany({
          where: { milestoneId: milestone.id, reviewerId: user.id, revieweeId: { in: teammates.map((t) => t.id) } },
          select: { revieweeId: true, contribution: true, comment: true },
        })
      : [];
  const peerDone = myPeerReviews.length >= teammates.length;

  // ── Côté équipe pédagogique : suivi groupes × étudiant·e·s ──
  const followUpGroups = isManager
    ? await db.group.findMany({
        where: { saeId: sae.id },
        orderBy: { name: "asc" },
        take: 200,
        select: {
          id: true,
          name: true,
          _count: { select: { depositLinks: { where: { milestoneId: milestone.id } } } },
          members: {
            orderBy: { joinedAt: "asc" },
            select: { userId: true, user: { select: { name: true } } },
          },
        },
      })
    : [];
  const followUpAssessments = isManager
    ? await db.selfAssessment.findMany({
        where: { milestoneId: milestone.id },
        take: 2000,
        select: {
          id: true,
          userId: true,
          status: true,
          feedbackPublishedAt: true,
          items: { select: { level: true, teacherLevel: true, teacherComment: true } },
        },
      })
    : [];
  const peerReviews =
    isManager && peerEnabled
      ? await db.peerReview.findMany({
          where: { milestoneId: milestone.id },
          orderBy: { updatedAt: "desc" },
          take: 5000,
          select: { reviewerId: true, revieweeId: true, contribution: true, comment: true, updatedAt: true },
        })
      : [];

  const assessmentByUser = new Map(followUpAssessments.map((a) => [a.userId, a]));
  const groupsView = followUpGroups.map((g) => ({
    id: g.id,
    name: g.name,
    depositCount: g._count.depositLinks,
    members: g.members.map((m) => ({ userId: m.userId, name: m.user.name })),
  }));
  const totalStudents = groupsView.reduce((n, g) => n + g.members.length, 0);
  const submitted = followUpAssessments.filter((a) => a.status === "SUBMITTED");
  const publishedCount = submitted.filter((a) => a.feedbackPublishedAt).length;
  const readyCount = submitted.filter((a) => !a.feedbackPublishedAt && isFeedbackReady(a.items)).length;

  const assessHref = `/saes/${sae.id}/milestones/${milestone.id}/assess`;
  const reviewHref = `/saes/${sae.id}/review?milestone=${milestone.id}`;

  const myStatus = myAssessment?.status ?? "NONE";

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        breadcrumbs={[
          { label: "SAÉ", href: "/saes" },
          { label: sae.code ?? sae.title, href: `/saes/${sae.id}` },
          { label: milestone.title },
        ]}
        title={milestone.title}
        meta={
          <>
            {!milestone.dueAt ? (
              <span>Sans échéance</span>
            ) : myGroup && myStatus !== "SUBMITTED" ? (
              <DeadlineChip due={milestone.dueAt} />
            ) : (
              <span>Échéance le {formatDateTime(milestone.dueAt)}</span>
            )}
            {milestone.requiresDepositUrl && <span>Dépôt d&apos;URL requis</span>}
          </>
        }
        actions={
          (isManager || myGroup) && (
            <>
              {isManager && (
                <Link href={reviewHref} className="btn btn-primary">
                  Corriger
                </Link>
              )}
              {myGroup &&
                (myAssessment?.status === "SUBMITTED" ? (
                  <Link href={`/assessments/${myAssessment.id}`} className="btn btn-primary">
                    {showMyFeedback ? "Voir le retour" : "Voir mon auto-évaluation"}
                  </Link>
                ) : (
                  <Link href={assessHref} className="btn btn-primary">
                    {myAssessment ? "Reprendre l'auto-évaluation" : "S'auto-évaluer"}
                  </Link>
                ))}
            </>
          )
        }
      />

      {milestone.description && (
        <section aria-label="Description du jalon">
          <p className="max-w-prose break-words whitespace-pre-line">{milestone.description}</p>
        </section>
      )}

      {myGroup && (
        <section aria-labelledby="my-assessment-title" className="flex flex-col gap-3">
          <h2 id="my-assessment-title" className="text-xl">
            Mon auto-évaluation
          </h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <AssessmentStatusBadge status={myStatus} />
            <span className="text-sm text-muted">
              Groupe{" "}
              <Link href={`/saes/${sae.id}/groups/${myGroup.id}`} className="link">
                {myGroup.name}
              </Link>
            </span>
          </div>

          {milestone.requiresDepositUrl && myGroup._count.depositLinks === 0 && (
            <p role="note" className="bg-danger-soft p-3 text-sm text-danger">
              Aucune URL déposée.{" "}
              <Link href={`/saes/${sae.id}/groups/${myGroup.id}#depots`} className="font-semibold underline">
                Ajouter une URL
              </Link>
            </p>
          )}

          {showMyFeedback && (
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span>Retour publié</span>
              <span>
                Moyenne auto <strong>{formatAverage(mySelfAvg)}</strong>
              </span>
              <span>
                Enseignant <strong>{formatAverage(myTeacherAvg)}</strong>
              </span>
              {myGaps > 0 && (
                <span>
                  {myGaps} écart{myGaps > 1 ? "s" : ""} important{myGaps > 1 ? "s" : ""}
                </span>
              )}
            </p>
          )}
        </section>
      )}

      {myGroup && peerEnabled && (
        <section aria-labelledby="peer-title" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <h2 id="peer-title" className="text-xl">
              Évaluation entre pairs
            </h2>
            {teammates.length > 0 && (
              <StatusBadge tone={peerDone ? "ok" : "warn"}>
                {peerDone ? "Envoyée" : `${myPeerReviews.length} sur ${teammates.length}`}
              </StatusBadge>
            )}
          </div>
          {teammates.length === 0 ? (
            <EmptyState>Aucun coéquipier à évaluer.</EmptyState>
          ) : peerOpen ? (
            <>
              {peerClosesAt && (
                <p className="text-sm text-muted">Modifiable jusqu&apos;au {formatDateTime(peerClosesAt)}</p>
              )}
              <PeerReviewForm
                action={savePeerReviews.bind(null, milestone.id)}
                teammates={teammates}
                existing={Object.fromEntries(
                  myPeerReviews.map((r) => [r.revieweeId, { contribution: r.contribution, comment: r.comment }]),
                )}
              />
            </>
          ) : (
            peerClosesAt && <p className="text-muted">Fermée depuis le {formatDateTime(peerClosesAt)}</p>
          )}
        </section>
      )}

      <section aria-labelledby="criteria-title" className="flex flex-col gap-3">
        <h2 id="criteria-title" className="text-xl">
          Critères
        </h2>
        {criteria.length === 0 ? (
          <EmptyState>Aucun critère.</EmptyState>
        ) : (
          <ol className="flex flex-col divide-y divide-line">
            {criteria.map((criterion) => (
              <li key={criterion.id} className="flex flex-col gap-1 py-4 first:pt-0">
                <CriterionHeading criterion={criterion} />
                {criterion.description && (
                  <p className="max-w-prose text-sm break-words whitespace-pre-line text-muted">
                    {criterion.description}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {isManager && (
        <section aria-labelledby="followup-title" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 id="followup-title" className="text-xl">
                Suivi des auto-évaluations
              </h2>
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                <span>
                  {submitted.length} soumise{submitted.length > 1 ? "s" : ""} sur {totalStudents}
                </span>
                <span>
                  {publishedCount} retour{publishedCount > 1 ? "s" : ""} publié{publishedCount > 1 ? "s" : ""}
                </span>
              </p>
            </div>
            {canEvaluate && readyCount > 0 && (
              <ConfirmActionButton
                action={publishReadyFeedback.bind(null, milestone.id)}
                label={`Publier ${readyCount} retour${readyCount > 1 ? "s" : ""} prêt${readyCount > 1 ? "s" : ""}`}
                pendingLabel="Publication…"
                confirmMessage={`Publier ${readyCount} retour${readyCount > 1 ? "s" : ""} ? Chaque étudiant·e concerné·e sera notifié·e.`}
              />
            )}
          </div>

          <FollowUp
            saeId={sae.id}
            requiresDepositUrl={milestone.requiresDepositUrl}
            groups={groupsView}
            assessmentByUser={assessmentByUser}
          />
        </section>
      )}

      {isManager && peerEnabled && (
        <PeerReviewOverview groups={groupsView} reviews={peerReviews} canSeeDetails={canSeePeerReviews(user, sae)} />
      )}
    </div>
  );
}
