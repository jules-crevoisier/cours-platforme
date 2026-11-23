import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { isStaff } from "@/lib/permissions";
import { isSignificantGap } from "@/lib/competences";
import { CompetenceRadar } from "@/components/competence-radar";
import { EmptyState, PageHeader, StatusBadge, Tabs } from "@/components/ui";
import { loadPortfolio, loadStudentParcours } from "@/app/me/portfolio/_lib/profile";
import { CompetenceDot, LevelScale, LevelText } from "@/app/me/portfolio/_components/ui";

export const metadata: Metadata = { title: "Mes compétences" };

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CompetencesPage({ searchParams }: PageProps<"/me/competences">) {
  const user = await requireUser();
  // Le profil de compétences concerne les étudiants : l'équipe pédagogique le consulte depuis /students
  if (isStaff(user)) redirect("/students");

  const sp = await searchParams;
  const showAll = one(sp.parcours) === "tous";

  const [portfolio, student] = await Promise.all([
    loadPortfolio(user.id, { includeTeacher: true }),
    loadStudentParcours(user.id),
  ]);
  const parcours = showAll ? null : student.parcours;
  const openLevel = student.year && student.year >= 1 && student.year <= 3 ? student.year : 1;
  const scoreByCode = new Map(portfolio.scores.map((s) => [s.code, s]));

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title="Mes compétences"
        actions={
          <Link href="/me/portfolio" className="btn">
            Mon portfolio
          </Link>
        }
      />

      <section aria-labelledby="radar-title" className="flex flex-col gap-4">
        <h2 id="radar-title" className="text-xl">
          Profil
        </h2>
        <div className="flex max-w-xl flex-col gap-4">
          <CompetenceRadar id="me-radar" scores={portfolio.scores} title="Mon profil de compétences" />
          <LevelScale />
        </div>
      </section>

      <section aria-labelledby="ac-title" className="flex flex-col gap-6">
        <h2 id="ac-title" className="text-xl">
          Apprentissages critiques
        </h2>

        {student.parcours && (
          <Tabs
            label="Parcours affichés"
            items={[
              { href: "/me/competences", label: `Parcours ${student.parcours}`, active: !showAll },
              { href: "/me/competences?parcours=tous", label: "Tous les parcours", active: showAll },
            ]}
          />
        )}

        {portfolio.referentiel.length === 0 && <EmptyState>Référentiel de compétences non chargé.</EmptyState>}

        {portfolio.referentiel.map((c) => {
          const score = scoreByCode.get(c.code);
          const learnings = c.learnings.filter((l) => !parcours || !l.parcours || l.parcours === parcours);
          const levels = [...new Set(learnings.map((l) => l.level))].sort((a, b) => a - b);
          const gap = isSignificantGap(score?.self, score?.teacher);
          return (
            <section key={c.id} aria-labelledby={`comp-${c.code}`} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <h3 id={`comp-${c.code}`} className="flex flex-wrap items-center gap-2 text-lg">
                    <CompetenceDot color={c.color} />
                    <span>{c.code}</span>
                    <span>{c.name}</span>
                  </h3>
                  {gap && <StatusBadge tone="warn">Écart avec l&apos;enseignant</StatusBadge>}
                </div>
                {c.description && <p className="max-w-prose text-sm text-muted">{c.description}</p>}
              </div>

              {levels.map((level) => {
                const list = learnings.filter((l) => l.level === level);
                const observed = list.filter((l) => portfolio.latestByLearning.has(l.id)).length;
                const levelLabel = c.levelLabels[level - 1];
                return (
                  <details key={level} open={level === openLevel} className="border border-line bg-surface">
                    <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
                      <span className="text-sm font-semibold">Niveau {level}</span>
                      {levelLabel && <span className="text-sm">{levelLabel}</span>}
                      <span className="ml-auto text-sm text-muted">
                        {observed} sur {list.length} observé{observed > 1 ? "s" : ""}
                      </span>
                    </summary>
                    <ul className="flex flex-col divide-y divide-line border-t border-line">
                      {list.map((l) => {
                        const latest = portfolio.latestByLearning.get(l.id);
                        const total =
                          (portfolio.evidencesByLearning.get(l.id)?.length ?? 0) +
                          (portfolio.tracesByLearning.get(l.id)?.length ?? 0);
                        return (
                          <li key={l.id} className="flex flex-col gap-1 px-4 py-3">
                            <p className="flex flex-wrap items-baseline gap-x-4">
                              <span className="text-sm font-semibold">{l.code}</span>
                              {l.parcours && <span className="text-sm text-muted">Parcours {l.parcours}</span>}
                            </p>
                            <p className="text-sm">{l.label}</p>
                            <div className="flex flex-wrap items-center gap-x-4">
                              <LevelText level={latest?.self?.level ?? null} />
                              <LevelText level={latest?.teacher?.level ?? null} who="Ens." />
                              {total > 0 ? (
                                <Link
                                  href={`/me/portfolio#ac-${l.code}`}
                                  className="ml-auto inline-flex min-h-11 items-center text-sm text-accent underline"
                                >
                                  {total} trace{total > 1 ? "s" : ""}
                                  <span className="sr-only"> pour {l.code}</span>
                                </Link>
                              ) : (
                                <Link
                                  href={`/me/portfolio?ac=${encodeURIComponent(l.code)}#nouvelle-trace`}
                                  className="ml-auto inline-flex min-h-11 items-center text-sm text-accent underline"
                                >
                                  Ajouter une trace<span className="sr-only"> pour {l.code}</span>
                                </Link>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                );
              })}
            </section>
          );
        })}
      </section>
    </div>
  );
}
