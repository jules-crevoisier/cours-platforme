import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { canCreateSae, canManageSae, isAdmin } from "@/lib/permissions";
import { SAE_GAP_LABELS, saeGaps } from "@/lib/coverage";
import { EmptyState, PageHeader, StatusBadge, Swatch } from "@/components/ui";

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
      _count: { select: { milestones: true } },
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
    <div className="flex flex-col gap-10">
      <PageHeader
        title="SAÉ"
        actions={
          canCreateSae(user) && (
            <Link href="/saes/new" className="btn btn-primary">
              Nouvelle SAÉ
            </Link>
          )
        }
      />

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
        <EmptyState>
          {onlyIncomplete ? "Aucune SAÉ à compléter : toutes ont des jalons, des dates et des AC visés." : "Aucune SAÉ."}
        </EmptyState>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {saes.map(({ sae, gaps }) => (
            <li key={sae.id}>
              <Link
                href={`/saes/${sae.id}`}
                className="card flex h-full min-h-11 items-start gap-4 transition-colors hover:border-ink"
              >
                <Swatch seed={sae.id} text={sae.code ?? sae.title} />
                <div className="flex min-w-0 flex-col gap-1">
                  {sae.code && <span className="text-sm text-muted">{sae.code}</span>}
                  <h2 className="text-lg break-words">{sae.title}</h2>
                  {(sae.semester || !sae.published || gaps.length > 0) && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                      {sae.semester && <span>Semestre {sae.semester}</span>}
                      {!sae.published && <StatusBadge tone="warn">Brouillon</StatusBadge>}
                      {gaps.map((g) => (
                        <StatusBadge key={g} tone="warn">
                          {SAE_GAP_LABELS[g]}
                        </StatusBadge>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
