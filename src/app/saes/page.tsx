import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { canCreateSae, canManageSae, isAdmin } from "@/lib/permissions";
import { SAE_GAP_LABELS, saeGaps } from "@/lib/coverage";
import { formatDateRange } from "./_lib/dates";

export const metadata: Metadata = { title: "SAÉ" };

export default async function SaesPage({ searchParams }: PageProps<"/saes">) {
  const user = await requireUser();
  const sp = await searchParams;
  const onlyIncomplete = sp.filtre === "a-completer";

  // Même règle que canViewSae : publiées, ou gérées (responsable / co-enseignant).
  // Un étudiant déjà placé dans un groupe ne voit la SAÉ qu'une fois publiée.
  const rows = await db.sae.findMany({
    where: isAdmin(user)
      ? {}
      : {
          OR: [{ published: true }, { ownerId: user.id }, { teachers: { some: { id: user.id } } }],
        },
    orderBy: [{ semester: "asc" }, { code: "asc" }, { title: "asc" }],
    take: 300,
    select: {
      id: true,
      code: true,
      title: true,
      semester: true,
      startsAt: true,
      endsAt: true,
      published: true,
      ownerId: true,
      teachers: { select: { id: true } },
      cohort: { select: { name: true } },
      _count: { select: { milestones: true } },
      groups: {
        where: { members: { some: { userId: user.id } } },
        select: { name: true },
      },
    },
  });

  // SAÉ qui visent au moins un AC (via les critères de leurs jalons) — réservé à l'équipe pédagogique.
  const managedIds = rows.filter((s) => canManageSae(user, s)).map((s) => s.id);
  const linked = managedIds.length
    ? await db.criterion.findMany({
        where: { learningId: { not: null }, milestone: { saeId: { in: managedIds } } },
        take: 5000,
        select: { milestone: { select: { saeId: true } } },
      })
    : [];
  const withAc = new Set(linked.map((c) => c.milestone.saeId));

  const all = rows.map((sae) => ({
    sae,
    gaps: canManageSae(user, sae)
      ? saeGaps({
          startsAt: sae.startsAt,
          endsAt: sae.endsAt,
          milestoneCount: sae._count.milestones,
          linkedLearningCount: withAc.has(sae.id) ? 1 : 0,
        })
      : [],
  }));
  const incompleteCount = all.filter((r) => r.gaps.length > 0).length;
  const saes = onlyIncomplete ? all.filter((r) => r.gaps.length > 0) : all;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Situations d&apos;apprentissage et d&apos;évaluation</p>
          <h1 className="text-2xl font-semibold">SAÉ</h1>
        </div>
        {canCreateSae(user) && (
          <Link href="/saes/new" className="btn btn-primary">
            Nouvelle SAÉ
          </Link>
        )}
      </div>

      {managedIds.length > 0 && (
        <nav aria-label="Filtrer les SAÉ" className="flex flex-wrap gap-2">
          <Link
            href="/saes"
            className={`btn ${onlyIncomplete ? "btn-ghost" : "btn-primary"}`}
            aria-current={onlyIncomplete ? undefined : "page"}
          >
            Toutes ({all.length})
          </Link>
          <Link
            href="/saes?filtre=a-completer"
            className={`btn ${onlyIncomplete ? "btn-primary" : "btn-ghost"}`}
            aria-current={onlyIncomplete ? "page" : undefined}
          >
            À compléter ({incompleteCount})
          </Link>
        </nav>
      )}

      {saes.length === 0 ? (
        <div className="card text-muted">
          {onlyIncomplete ? (
            <p>Aucune SAÉ à compléter : toutes ont des jalons, des dates et des AC visés.</p>
          ) : (
            <>
              <p>Aucune SAÉ pour l&apos;instant. Elles apparaissent ici dès que l&apos;équipe pédagogique les publie.</p>
              {canCreateSae(user) && (
                <p className="mt-1">
                  <Link href="/saes/new" className="underline">
                    Créer la première SAÉ
                  </Link>
                </p>
              )}
            </>
          )}
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {saes.map(({ sae, gaps }) => {
            const range = formatDateRange(sae.startsAt, sae.endsAt);
            const myGroup = sae.groups[0];
            return (
              <li key={sae.id}>
                <Link
                  href={`/saes/${sae.id}`}
                  className="card block h-full min-h-11 transition-colors hover:border-accent"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {sae.code && <span className="font-mono text-sm font-semibold text-accent">{sae.code}</span>}
                    {sae.semester && <span className="badge font-mono">S{sae.semester}</span>}
                    {sae.cohort && <span className="badge">{sae.cohort.name}</span>}
                    {!sae.published && <span className="badge badge-warn">Brouillon</span>}
                    {canManageSae(user, sae) && <span className="badge badge-accent">Gérée</span>}
                  </div>
                  <h2 className="mt-2 font-semibold break-words">{sae.title}</h2>
                  {range && <p className="mt-1 text-sm text-muted">{range}</p>}
                  {myGroup && <p className="mt-1 text-sm">Mon groupe : {myGroup.name}</p>}
                  {gaps.length > 0 && (
                    <p className="mt-2 flex flex-wrap gap-2">
                      {gaps.map((g) => (
                        <span key={g} className="badge badge-warn">
                          {SAE_GAP_LABELS[g]}
                        </span>
                      ))}
                    </p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
