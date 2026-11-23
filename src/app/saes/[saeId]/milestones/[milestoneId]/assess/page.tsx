import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { assertAllowed, requireUser } from "@/lib/session";
import { canEditAssessment, canViewSae } from "@/lib/permissions";
import { criterionSelect, formatDateTime, toCriterionView } from "@/app/assessments/_lib/shared";
import { DeadlineChip, PageHeader } from "@/components/ui";
import { saveAssessment } from "./actions";
import { AssessForm } from "./assess-form";

export const metadata: Metadata = { title: "Mon auto-évaluation" };

export default async function AssessPage({ params }: PageProps<"/saes/[saeId]/milestones/[milestoneId]/assess">) {
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
  assertAllowed(canViewSae(user, milestone.sae));

  // Réservé aux membres d'un groupe de cette SAÉ
  const group = await db.group.findFirst({
    where: { saeId: milestone.saeId, members: { some: { userId: user.id } } },
    select: { id: true },
  });
  assertAllowed(!!group);

  const assessment = await db.selfAssessment.findUnique({
    where: { milestoneId_userId: { milestoneId: milestone.id, userId: user.id } },
    select: {
      id: true,
      userId: true,
      status: true,
      reflection: true,
      updatedAt: true,
      items: { select: { criterionId: true, level: true, justification: true } },
    },
  });
  if (assessment?.status === "SUBMITTED") redirect(`/assessments/${assessment.id}`);
  if (assessment) assertAllowed(canEditAssessment(user, assessment));

  const existingItems = Object.fromEntries(
    (assessment?.items ?? []).map((item) => [item.criterionId, { level: item.level, justification: item.justification }]),
  );

  const { sae } = milestone;
  const milestoneHref = `/saes/${sae.id}/milestones/${milestone.id}`;

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        breadcrumbs={[
          { label: "SAÉ", href: "/saes" },
          { label: sae.code ?? sae.title, href: `/saes/${sae.id}` },
          { label: milestone.title, href: milestoneHref },
          { label: "Auto-évaluation" },
        ]}
        title="Mon auto-évaluation"
        meta={
          (milestone.dueAt || assessment) && (
            <>
              {milestone.dueAt && <DeadlineChip due={milestone.dueAt} />}
              {assessment && <span>Brouillon enregistré le {formatDateTime(assessment.updatedAt)}</span>}
            </>
          )
        }
      />

      <AssessForm
        action={saveAssessment.bind(null, milestone.id)}
        criteria={milestone.criteria.map(toCriterionView)}
        existingItems={existingItems}
        reflection={assessment?.reflection ?? ""}
      />
    </div>
  );
}
