import type { Metadata } from "next";
import { categoryLabel, showcaseSnapshot } from "@/app/vitrine/_lib/showcase";
import Link from "next/link";
import { db } from "@/lib/db";
import { assertAllowed, requireUser } from "@/lib/session";
import { canPublishShowcase, isAdmin, isStaff } from "@/lib/permissions";
import type { Prisma } from "@/generated/prisma/client";
import { EmptyState, PageHeader, Tabs } from "@/components/ui";
import { ShowcaseCard } from "../_components/showcase-card";
import { ModerationControls } from "../_components/moderation-controls";
import { moderateShowcase } from "../actions";

export const metadata: Metadata = { title: "Modération de la vitrine", robots: { index: false, follow: false } };

const LIMIT = 50;

export default async function ModerationPage({ searchParams }: PageProps<"/vitrine/moderation">) {
  const user = await requireUser();
  assertAllowed(isStaff(user));
  // Onglets : demandes en attente (par défaut) ou projets déjà publiés (pour les retirer)
  const tab = (await searchParams).onglet === "publies" ? "published" : "pending";

  // SAÉ gérées par l'enseignant (toutes pour un administrateur)
  const managed: Prisma.GroupWhereInput = isAdmin(user)
    ? {}
    : { sae: { OR: [{ ownerId: user.id }, { teachers: { some: { id: user.id } } }] } };

  const select = {
    id: true,
    name: true,
    saeId: true,
    showcaseStatus: true,
    showcaseTitle: true,
    showcaseSummary: true,
    showcaseUrl: true,
    showcaseImageUrl: true,
    showcaseCategory: true,
    updatedAt: true,
    sae: {
      select: { code: true, title: true, semester: true, ownerId: true, published: true, teachers: { select: { id: true } } },
    },
    members: { orderBy: { joinedAt: "asc" as const }, take: 12, select: { user: { select: { name: true } } } },
  } satisfies Prisma.GroupSelect;

  const [pending, published] = await Promise.all([
    db.group.findMany({
      where: { ...managed, showcaseStatus: "PENDING" },
      orderBy: { updatedAt: "asc" },
      take: LIMIT,
      select,
    }),
    db.group.findMany({
      where: { ...managed, showcaseStatus: "PUBLISHED" },
      orderBy: [{ sae: { semester: "desc" } }, { createdAt: "desc" }],
      take: LIMIT,
      select,
    }),
  ]);

  const moderable = (g: (typeof pending)[number]) =>
    canPublishShowcase(user, g.sae) && (g.showcaseStatus === "PENDING" || g.showcaseStatus === "PUBLISHED");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader breadcrumbs={[{ label: "Vitrine", href: "/vitrine" }, { label: "Modération" }]} title="Modération" />

      <Tabs
        label="Projets à modérer"
        items={[
          { href: "/vitrine/moderation", label: "En attente", active: tab === "pending", count: pending.length },
          { href: "/vitrine/moderation?onglet=publies", label: "Publiés", active: tab === "published", count: published.length },
        ]}
      />

      {tab === "pending" &&
        (pending.length === 0 ? (
          <EmptyState>Aucune demande en attente.</EmptyState>
        ) : (
          <ul className="grid gap-6 md:grid-cols-2">
            {pending.map((g) => (
              <li key={g.id} className="flex flex-col gap-3">
                <ShowcaseCard
                  id={g.id}
                  title={g.showcaseTitle ?? "Projet sans titre"}
                  summary={g.showcaseSummary}
                  url={g.showcaseUrl}
                  imageUrl={g.showcaseImageUrl}
                  category={g.showcaseCategory}
                  saeCode={g.sae.code}
                  saeTitle={g.sae.title}
                  semester={g.sae.semester}
                  members={g.members.map((m) => m.user.name)}
                />
                <Link href={`/saes/${g.saeId}/groups/${g.id}#vitrine`} className="link inline-flex min-h-11 items-center self-start text-sm">
                  Groupe « {g.name} »
                </Link>
                {moderable(g) && (
                  <ModerationControls status="PENDING" groupName={g.name} action={moderateShowcase.bind(null, g.id, showcaseSnapshot(g))} />
                )}
              </li>
            ))}
          </ul>
        ))}

      {tab === "published" &&
        (published.length === 0 ? (
          <EmptyState>Aucun projet publié.</EmptyState>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {published.map((g) => (
              <li key={g.id} className="flex flex-col gap-3 py-4 md:flex-row md:items-start md:justify-between md:gap-6">
                <div className="flex min-w-0 flex-col gap-1">
                  <Link href={`/saes/${g.saeId}/groups/${g.id}#vitrine`} className="font-semibold break-words hover:underline">
                    {g.showcaseTitle ?? "Projet sans titre"}
                  </Link>
                  <p className="flex flex-wrap gap-x-4 text-sm text-muted">
                    <span>{g.name}</span>
                    {g.sae.code && <span>{g.sae.code}</span>}
                    <span>{categoryLabel(g.showcaseCategory)}</span>
                  </p>
                </div>
                {moderable(g) && (
                  <div className="md:max-w-sm md:shrink-0">
                    <ModerationControls status="PUBLISHED" groupName={g.name} action={moderateShowcase.bind(null, g.id, showcaseSnapshot(g))} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
