import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { db } from "@/lib/db";
import { assertAllowed, requireUser } from "@/lib/session";
import { isAdmin, isStaff } from "@/lib/permissions";
import { buildCoverage, type LearningRef } from "@/lib/coverage";
import { safeColor } from "@/app/saes/_lib/criteria";

export const metadata: Metadata = { title: "Couverture du référentiel" };

export default async function CouverturePage() {
  const user = await requireUser();
  assertAllowed(isStaff(user));

  // Mêmes SAÉ que celles visibles dans /saes pour cet utilisateur.
  const saes = await db.sae.findMany({
    where: isAdmin(user)
      ? {}
      : { OR: [{ published: true }, { ownerId: user.id }, { teachers: { some: { id: user.id } } }] },
    orderBy: [{ semester: "asc" }, { code: "asc" }],
    take: 300,
    select: { id: true, code: true, title: true, semester: true },
  });

  const [competences, criteria] = await Promise.all([
    db.competence.findMany({
      orderBy: [{ position: "asc" }, { code: "asc" }],
      take: 20,
      select: {
        code: true,
        name: true,
        color: true,
        learnings: { orderBy: { code: "asc" }, take: 300, select: { id: true, code: true, label: true, level: true } },
      },
    }),
    db.criterion.findMany({
      where: { learningId: { not: null }, milestone: { saeId: { in: saes.map((s) => s.id) } } },
      take: 5000,
      select: { learningId: true, milestone: { select: { saeId: true } } },
    }),
  ]);

  const learnings: LearningRef[] = competences.flatMap((c) =>
    c.learnings.map((l) => ({ ...l, competenceCode: c.code })),
  );
  const coverage = buildCoverage(
    learnings,
    saes,
    criteria.flatMap((c) => (c.learningId ? [{ learningId: c.learningId, saeId: c.milestone.saeId }] : [])),
  );
  const byLearning = new Map(coverage.rows.map((r) => [r.learning.id, new Set(r.saes.map((s) => s.id))]));
  const percent = coverage.total ? Math.round((coverage.covered / coverage.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        breadcrumbs={[{ label: "Référentiel", href: "/admin/referentiel" }, { label: "Couverture" }]}
        title="Couverture du référentiel par les SAÉ"
        meta={
          <>
            <span>
              {coverage.covered} / {coverage.total} AC couverts ({percent} %)
            </span>
            <span>{coverage.columns.length} SAÉ rattachées</span>
          </>
        }
      />

      {coverage.total === 0 ? (
        <EmptyState>
          Le référentiel n&apos;est pas chargé en base. Lancez <span className="font-mono">npm run db:seed</span>.
        </EmptyState>
      ) : coverage.columns.length === 0 ? (
        <EmptyState>
          Aucune SAÉ ne vise encore d&apos;AC : reliez les critères de vos jalons à un apprentissage critique depuis la
          gestion de chaque SAÉ.
        </EmptyState>
      ) : (
        competences.map((c) => (
          <section key={c.code} className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <span
                aria-hidden="true"
                className="inline-block size-3 rounded-full bg-muted"
                style={{ backgroundColor: safeColor(c.color) }}
              />
              <span className="font-mono text-sm text-muted">{c.code}</span> {c.name}
            </h2>
            <div className="card overflow-x-auto p-0">
              <table className="w-full min-w-max border-collapse text-sm">
                <caption className="sr-only">AC de la compétence {c.name} et SAÉ qui les visent</caption>
                <thead>
                  <tr className="border-b border-line text-left">
                    <th scope="col" className="sticky left-0 bg-surface p-3 font-medium">
                      AC
                    </th>
                    {coverage.columns.map((s) => (
                      <th key={s.id} scope="col" className="p-3 text-center font-mono text-xs font-medium" title={s.title}>
                        <Link href={`/saes/${s.id}`} className="underline">
                          {s.code ?? s.title.slice(0, 12)}
                        </Link>
                        {s.semester && <span className="block text-muted">S{s.semester}</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {c.learnings.map((l) => {
                    const set = byLearning.get(l.id) ?? new Set<string>();
                    const empty = set.size === 0;
                    return (
                      <tr key={l.id} className={empty ? "bg-warn-soft" : undefined}>
                        <th scope="row" className="sticky left-0 max-w-sm bg-surface p-3 text-left font-normal">
                          <span className="badge mr-2 font-mono">{l.code}</span>
                          <span className="break-words">{l.label}</span>
                          {empty && <StatusBadge tone="warn">Non couvert</StatusBadge>}
                        </th>
                        {coverage.columns.map((s) => (
                          <td key={s.id} className="p-3 text-center">
                            {set.has(s.id) ? (
                              <>
                                <span aria-hidden="true">●</span>
                                <span className="sr-only">visé</span>
                              </>
                            ) : (
                              <span className="sr-only">non visé</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
    </div>
  );
}
