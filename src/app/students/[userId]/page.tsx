import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { assertAllowed, requireUser } from "@/lib/session";
import { canManageSae, canViewAssessment, canViewPortfolio, canViewSae, isStaff } from "@/lib/permissions";
import { AssessmentStatusBadge, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { CompetenceRadar } from "@/components/competence-radar";
import { loadPortfolio, loadStudentParcours } from "@/app/me/portfolio/_lib/profile";
import { PortfolioSections } from "@/app/me/portfolio/_components/portfolio-sections";
import { PrintButton } from "@/app/me/portfolio/_components/share-tools";

export const metadata: Metadata = { title: "Fiche étudiant", robots: { index: false, follow: false } };

const SHOWCASE = {
  NONE: null,
  PENDING: { tone: "neutral", label: "Vitrine : en attente" },
  PUBLISHED: { tone: "ok", label: "Vitrine : publié" },
} as const;

export default async function StudentPage({ params }: PageProps<"/students/[userId]">) {
  const { userId } = await params;
  const user = await requireUser();
  if (userId.length > 64) notFound();
  assertAllowed(canViewPortfolio(user, userId));

  const student = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
  if (!student) notFound();

  const saeAccess = { ownerId: true, published: true, teachers: { select: { id: true } } } as const;
  const [portfolio, info, memberships, assessments] = await Promise.all([
    loadPortfolio(student.id, { includeTeacher: true }),
    loadStudentParcours(student.id),
    db.groupMember.findMany({
      where: { userId: student.id },
      orderBy: { joinedAt: "desc" },
      take: 50,
      select: {
        group: {
          select: {
            id: true,
            name: true,
            showcaseStatus: true,
            sae: { select: { id: true, code: true, title: true, ...saeAccess } },
          },
        },
      },
    }),
    db.selfAssessment.findMany({
      where: { userId: student.id },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        status: true,
        feedbackPublishedAt: true,
        milestone: {
          select: { title: true, sae: { select: { id: true, code: true, title: true, ...saeAccess } } },
        },
      },
    }),
  ]);

  const isSelf = user.id === student.id;
  const title = isSelf ? "Ma fiche" : student.name;

  // Une seule présentation du travail en SAÉ : chaque SAÉ avec le groupe de l'étudiant et ses auto-évaluations
  type SaeRef = (typeof memberships)[number]["group"]["sae"];
  const saes = new Map<
    string,
    { sae: SaeRef; groups: (typeof memberships)[number]["group"][]; assessments: typeof assessments }
  >();
  for (const { group } of memberships) {
    const row = saes.get(group.sae.id) ?? { sae: group.sae, groups: [], assessments: [] };
    row.groups.push(group);
    saes.set(group.sae.id, row);
  }
  for (const a of assessments) {
    const row = saes.get(a.milestone.sae.id) ?? { sae: a.milestone.sae, groups: [], assessments: [] };
    row.assessments.push(a);
    saes.set(a.milestone.sae.id, row);
  }

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        breadcrumbs={isStaff(user) ? [{ label: "Étudiants", href: "/students" }, { label: student.name }] : undefined}
        title={title}
        meta={
          <>
            <span className="break-all">{student.email}</span>
            {info.cohorts.map((c) => (
              <span key={c.id}>
                {c.name} {c.academicYear}
                {c.parcours ? ` (${c.parcours})` : ""}
              </span>
            ))}
          </>
        }
        actions={<PrintButton />}
      />

      <section aria-labelledby="st-radar" className="flex flex-col gap-4">
        <h2 id="st-radar" className="text-xl">
          Compétences
        </h2>
        <CompetenceRadar
          id="student-radar"
          scores={portfolio.scores}
          title={`Profil de compétences de ${student.name}`}
          className="max-w-xl"
        />
      </section>

      <section aria-labelledby="st-saes" className="flex flex-col gap-3">
        <h2 id="st-saes" className="text-xl">
          SAÉ
        </h2>
        {saes.size === 0 ? (
          <EmptyState>Aucune SAÉ.</EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-line border-y border-line">
            {[...saes.values()].map(({ sae, groups, assessments: list }) => (
              <li key={sae.id} className="flex flex-col gap-2 py-4">
                <h3 className="text-base break-words">{sae.code ? `${sae.code} ${sae.title}` : sae.title}</h3>
                {groups.map((group) => {
                  const canOpen = canManageSae(user, group.sae) || (isSelf && canViewSae(user, group.sae));
                  const showcase = SHOWCASE[group.showcaseStatus];
                  return (
                    <p key={group.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      {canOpen ? (
                        <Link
                          href={`/saes/${group.sae.id}/groups/${group.id}`}
                          className="inline-flex min-h-11 items-center text-accent underline"
                        >
                          <span className="sr-only">Espace du groupe </span>
                          {group.name}
                        </Link>
                      ) : (
                        <span>{group.name}</span>
                      )}
                      {showcase && <StatusBadge tone={showcase.tone}>{showcase.label}</StatusBadge>}
                    </p>
                  );
                })}
                {list.length > 0 && (
                  <ul aria-label={`Auto-évaluations : ${sae.code ?? sae.title}`} className="flex flex-col">
                    {list.map((a) => {
                      const allowed = canViewAssessment(
                        user,
                        { userId: student.id, status: a.status, group: null },
                        a.milestone.sae,
                      );
                      return (
                        <li key={a.id} className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                          {allowed ? (
                            <Link href={`/assessments/${a.id}`} className="break-words text-accent underline">
                              {a.milestone.title}
                            </Link>
                          ) : (
                            <span className="break-words">{a.milestone.title}</span>
                          )}
                          <AssessmentStatusBadge status={a.status} />
                          {a.feedbackPublishedAt && <span className="text-muted">Retour publié</span>}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="st-portfolio" className="flex flex-col gap-4">
        <h2 id="st-portfolio" className="text-xl">
          Portfolio
        </h2>
        <PortfolioSections
          portfolio={portfolio}
          mode="staff"
          saeTraces={false}
          emptyMessage="Aucune trace personnelle."
        />
      </section>
    </div>
  );
}
