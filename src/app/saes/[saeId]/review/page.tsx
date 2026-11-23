import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { assertAllowed, requireUser } from "@/lib/session";
import { canEvaluateAssessment } from "@/lib/permissions";
import { PROVIDER_LABELS } from "@/lib/deposit";
import { criterionSelect, feedbackStatus, formatDateTime, toCriterionView } from "@/app/assessments/_lib/shared";
import { FeedbackStatusBadge, LinkStatusBadge } from "@/app/assessments/_lib/ui";
import { CriteriaComparison } from "@/app/assessments/_lib/comparison";
import { ConfirmActionButton } from "@/app/assessments/_lib/confirm-action-button";
import { TeacherFeedbackForm } from "@/app/assessments/_lib/teacher-feedback-form";
import { listMySnippets } from "@/app/assessments/_lib/snippets";
import { saveTeacherFeedback, unpublishFeedback } from "@/app/assessments/[assessmentId]/actions";
import { EmptyState, PageHeader, Tabs, type Crumb } from "@/components/ui";
import { QueueNav } from "./queue-nav";

export const metadata: Metadata = { title: "Correction", robots: { index: false } };

type Filter = "all" | "unpublished";

function pick(value: string | string[] | undefined) {
  return typeof value === "string" ? value : Array.isArray(value) ? value[0] : undefined;
}

const isHttpUrl = (url: string) => /^https?:\/\//i.test(url);

export default async function ReviewQueuePage({ params, searchParams }: PageProps<"/saes/[saeId]/review">) {
  const { saeId } = await params;
  const query = await searchParams;
  const user = await requireUser();

  const sae = await db.sae.findUnique({
    where: { id: saeId },
    select: {
      id: true,
      code: true,
      title: true,
      ownerId: true,
      published: true,
      teachers: { select: { id: true } },
      milestones: {
        orderBy: [{ position: "asc" }, { dueAt: "asc" }],
        take: 100,
        select: { id: true, title: true, requiresDepositUrl: true },
      },
    },
  });
  if (!sae) notFound();
  assertAllowed(canEvaluateAssessment(user, sae));

  const milestone = sae.milestones.find((m) => m.id === pick(query.milestone));
  const filter: Filter = pick(query.filter) === "unpublished" ? "unpublished" : "all";
  const saeCrumbs: Crumb[] = [
    { label: "SAÉ", href: "/saes" },
    { label: sae.code ?? sae.title, href: `/saes/${sae.id}` },
  ];

  // ── Pas de jalon choisi : liste des jalons avec leur avancement ──
  if (!milestone) {
    const [submittedByMilestone, unpublishedByMilestone] = await Promise.all([
      db.selfAssessment.groupBy({
        by: ["milestoneId"],
        where: { milestone: { saeId: sae.id }, status: "SUBMITTED" },
        _count: { _all: true },
      }),
      db.selfAssessment.groupBy({
        by: ["milestoneId"],
        where: { milestone: { saeId: sae.id }, status: "SUBMITTED", feedbackPublishedAt: null },
        _count: { _all: true },
      }),
    ]);
    const submitted = new Map(submittedByMilestone.map((g) => [g.milestoneId, g._count._all]));
    const unpublished = new Map(unpublishedByMilestone.map((g) => [g.milestoneId, g._count._all]));

    return (
      <div className="flex flex-col gap-10">
        <PageHeader breadcrumbs={[...saeCrumbs, { label: "Correction" }]} title="Correction" />
        {sae.milestones.length === 0 ? (
          <EmptyState>Aucun jalon.</EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {sae.milestones.map((m) => {
              const total = submitted.get(m.id) ?? 0;
              const todo = unpublished.get(m.id) ?? 0;
              return (
                <li key={m.id} className="flex flex-col gap-2 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="font-semibold break-words">{m.title}</span>
                    <span className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                      <span>
                        {total} soumise{total > 1 ? "s" : ""}
                      </span>
                      <span>{todo} sans retour publié</span>
                    </span>
                  </div>
                  <Link
                    href={`/saes/${sae.id}/review?milestone=${m.id}${todo > 0 ? "&filter=unpublished" : ""}`}
                    className="btn w-full sm:w-auto"
                    aria-label={`Corriger : ${m.title}`}
                  >
                    Corriger
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  // ── File du jalon ──
  const requestedId = pick(query.a);
  const baseWhere = { milestoneId: milestone.id, status: "SUBMITTED" as const };
  const [totalSubmitted, unpublishedCount, list, criteriaRows, snippets] = await Promise.all([
    db.selfAssessment.count({ where: baseWhere }),
    db.selfAssessment.count({ where: { ...baseWhere, feedbackPublishedAt: null } }),
    db.selfAssessment.findMany({
      where:
        filter === "unpublished"
          ? // L'auto-évaluation affichée reste dans la file même une fois publiée (navigation stable)
            { ...baseWhere, OR: [{ feedbackPublishedAt: null }, ...(requestedId ? [{ id: requestedId }] : [])] }
          : baseWhere,
      orderBy: [{ group: { name: "asc" } }, { user: { name: "asc" } }],
      select: { id: true },
      take: 1000,
    }),
    db.criterion.findMany({
      where: { milestoneId: milestone.id },
      orderBy: { position: "asc" },
      select: criterionSelect,
    }),
    listMySnippets(user),
  ]);

  const found = requestedId ? list.findIndex((x) => x.id === requestedId) : -1;
  const index = found >= 0 ? found : 0;
  const currentId = list[index]?.id;

  const hrefFor = (id: string) =>
    `/saes/${sae.id}/review?milestone=${milestone.id}${filter === "unpublished" ? "&filter=unpublished" : ""}&a=${id}`;
  const filterHref = (f: Filter) =>
    `/saes/${sae.id}/review?milestone=${milestone.id}${f === "unpublished" ? "&filter=unpublished" : ""}${currentId ? `&a=${currentId}` : ""}`;
  const prevHref = index > 0 ? hrefFor(list[index - 1].id) : null;
  const nextHref = index < list.length - 1 ? hrefFor(list[index + 1].id) : null;

  const current = currentId
    ? await db.selfAssessment.findUnique({
        where: { id: currentId },
        select: {
          id: true,
          submittedAt: true,
          feedbackPublishedAt: true,
          reflection: true,
          user: { select: { name: true } },
          group: { select: { id: true, name: true } },
          items: {
            select: { criterionId: true, level: true, justification: true, teacherLevel: true, teacherComment: true },
          },
          _count: { select: { comments: true } },
        },
      })
    : null;

  const depositLinks = current?.group
    ? await db.depositLink.findMany({
        where: { groupId: current.group.id, milestoneId: milestone.id },
        orderBy: { createdAt: "asc" },
        take: 50,
        select: {
          id: true,
          url: true,
          label: true,
          provider: true,
          checkStatus: true,
          checkedAt: true,
          checkNote: true,
        },
      })
    : [];

  const itemByCriterion = new Map((current?.items ?? []).map((i) => [i.criterionId, i]));
  const criteria = criteriaRows.map((c) => {
    const item = itemByCriterion.get(c.id);
    return {
      ...toCriterionView(c),
      self: item ? { level: item.level, justification: item.justification } : null,
      teacher: null,
      teacherLevel: item?.teacherLevel ?? null,
      teacherComment: item?.teacherComment ?? null,
    };
  });

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-6">
        <PageHeader
          breadcrumbs={[
            ...saeCrumbs,
            { label: milestone.title, href: `/saes/${sae.id}/milestones/${milestone.id}` },
            { label: "Correction" },
          ]}
          title="Correction"
        />

        <form method="get" action={`/saes/${sae.id}/review`} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="sm:min-w-64">
            <label htmlFor="milestone-select" className="label">
              Jalon
            </label>
            <select id="milestone-select" name="milestone" defaultValue={milestone.id} className="input">
              {sae.milestones.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </div>
          {filter === "unpublished" && <input type="hidden" name="filter" value="unpublished" />}
          <button type="submit" className="btn">
            Afficher
          </button>
        </form>

        <Tabs
          label="Filtrer la file"
          items={[
            { href: filterHref("all"), label: "Toutes les soumises", active: filter === "all", count: totalSubmitted },
            {
              href: filterHref("unpublished"),
              label: "Sans retour publié",
              active: filter === "unpublished",
              count: unpublishedCount,
            },
          ]}
        />
      </div>

      {!current ? (
        <EmptyState>
          {totalSubmitted === 0 ? "Aucune auto-évaluation soumise." : "Tous les retours sont publiés."}
        </EmptyState>
      ) : (
        <>
          <QueueNav prevHref={prevHref} nextHref={nextHref} position={index + 1} total={list.length} />

          <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
            <section aria-labelledby="student-title" className="flex flex-col gap-8">
              <div className="flex flex-col gap-2">
                <h2 id="student-title" className="text-xl break-words">
                  {current.user.name}
                </h2>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  <dt className="text-muted">Groupe</dt>
                  <dd className="break-words">
                    {current.group ? (
                      <Link href={`/saes/${sae.id}/groups/${current.group.id}`} className="link">
                        {current.group.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </dd>
                  <dt className="text-muted">Soumise le</dt>
                  <dd>{current.submittedAt ? formatDateTime(current.submittedAt) : "—"}</dd>
                  <dt className="text-muted">Commentaires</dt>
                  <dd>{current._count.comments}</dd>
                </dl>
                <Link href={`/assessments/${current.id}`} className="link inline-flex min-h-11 items-center self-start text-sm">
                  Page complète
                </Link>
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="text-base">Dépôts</h3>
                {depositLinks.length === 0 ? (
                  <p className={`text-sm ${milestone.requiresDepositUrl ? "text-danger" : "text-muted"}`}>
                    Aucune URL déposée{milestone.requiresDepositUrl ? " (dépôt requis)" : ""}.
                  </p>
                ) : (
                  <ul className="flex flex-col divide-y divide-line">
                    {depositLinks.map((link) => (
                      <li key={link.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
                        {isHttpUrl(link.url) ? (
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            title={`${PROVIDER_LABELS[link.provider]} — ${link.url}`}
                            className="link inline-flex min-h-11 min-w-0 items-center break-all"
                          >
                            {link.label ?? link.url}
                            <span className="sr-only"> (nouvel onglet)</span>
                          </a>
                        ) : (
                          <span className="min-w-0 break-all">{link.label ?? link.url}</span>
                        )}
                        <LinkStatusBadge
                          status={link.checkStatus}
                          checkedAt={link.checkedAt}
                          note={link.checkNote}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <h3 className="text-base">Auto-positionnement</h3>
                <CriteriaComparison criteria={criteria} showTeacher={false} headingLevel={4} />
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="text-base">Réflexion globale</h3>
                {current.reflection ? (
                  <p className="max-w-prose break-words whitespace-pre-line">{current.reflection}</p>
                ) : (
                  <p className="text-sm text-muted">Aucune réflexion rédigée.</p>
                )}
              </div>
            </section>

            <section aria-labelledby="teacher-title" className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="teacher-title" className="text-xl">
                  Positionnement enseignant
                </h2>
                {!current.feedbackPublishedAt && <FeedbackStatusBadge status={feedbackStatus(current)} />}
              </div>
              {current.feedbackPublishedAt && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
                  <span>Publié le {formatDateTime(current.feedbackPublishedAt)}</span>
                  <ConfirmActionButton
                    action={unpublishFeedback.bind(null, current.id)}
                    label="Dépublier"
                    pendingLabel="Dépublication…"
                    confirmMessage="Dépublier ce retour ? L'étudiant·e ne le verra plus jusqu'à la prochaine publication."
                  />
                </div>
              )}
              <TeacherFeedbackForm
                key={current.id}
                action={saveTeacherFeedback.bind(null, current.id)}
                criteria={criteria}
                snippets={snippets}
                published={!!current.feedbackPublishedAt}
                afterPublishHref={nextHref}
              />
            </section>
          </div>
        </>
      )}
    </div>
  );
}
