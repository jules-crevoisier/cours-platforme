import type { Metadata } from "next";
import Link from "next/link";
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
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="eyebrow">Administration</p>
        <h1 className="text-2xl font-semibold text-balance">Couverture du référentiel par les SAÉ</h1>
        <p className="max-w-prose text-muted">
          Pour chaque apprentissage critique (AC), les SAÉ dont au moins un critère de jalon le vise. Un AC sans aucune
          SAÉ n&apos;est évalué nulle part : à planifier ou à rattacher.
        </p>
        <p className="font-mono text-sm text-muted">
          {coverage.covered} / {coverage.total} AC couverts ({percent} %) · {coverage.columns.length} SAÉ rattachées
        </p>
        <p>
          <Link href="/admin/referentiel" className="underline">
            ← Référentiel
          </Link>
        </p>
      </header>

      {coverage.total === 0 ? (
        <p className="card text-muted">
          Le référentiel n&apos;est pas chargé en base. Lancez <span className="font-mono">npm run db:seed</span>.
        </p>
      ) : coverage.columns.length === 0 ? (
        <p className="card text-muted">
          Aucune SAÉ ne vise encore d&apos;AC : reliez les critères de vos jalons à un apprentissage critique depuis la
          gestion de chaque SAÉ.
        </p>
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
                          {empty && <span className="badge badge-warn ml-2">Non couvert</span>}
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
