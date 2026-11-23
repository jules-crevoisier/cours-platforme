import type { Metadata } from "next";
import { db } from "@/lib/db";
import { assertAllowed, requireUser } from "@/lib/session";
import { canAnnounce, isAdmin } from "@/lib/permissions";
import { formatDateTime, timeAgo } from "@/lib/format";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/app/admin/users/_components/action-form";
import { createAnnouncement, deleteAnnouncement } from "./actions";
import { AnnouncementForm } from "./_components/announcement-form";

export const metadata: Metadata = { title: "Annonces" };

const LIST_LIMIT = 50;

export default async function AnnouncementsPage() {
  const user = await requireUser();
  const allowGlobal = canAnnounce(user, { scope: "GLOBAL" });
  const allowCohort = canAnnounce(user, { scope: "COHORT" });
  assertAllowed(allowGlobal || allowCohort);

  const [announcements, cohorts] = await Promise.all([
    db.announcement.findMany({
      where: { scope: { in: allowGlobal ? ["GLOBAL", "COHORT"] : ["COHORT"] } },
      select: {
        id: true,
        scope: true,
        title: true,
        body: true,
        pinned: true,
        createdAt: true,
        authorId: true,
        author: { select: { name: true } },
        cohort: { select: { name: true, academicYear: true } },
      },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: LIST_LIMIT,
    }),
    allowCohort
      ? db.cohort.findMany({
          select: { id: true, name: true, academicYear: true, _count: { select: { members: true } } },
          orderBy: [{ academicYear: "desc" }, { year: "asc" }, { name: "asc" }],
          take: 300,
        })
      : Promise.resolve([]),
  ]);

  const cohortOptions = cohorts.map((c) => ({
    id: c.id,
    label: `${c.name} (${c.academicYear}), ${c._count.members} membre${c._count.members > 1 ? "s" : ""}`,
  }));
  const now = new Date();

  return (
    <div className="flex flex-col gap-10">
      <PageHeader title="Annonces" />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
        <section aria-labelledby="announcement-list" className="order-2 flex min-w-0 flex-col gap-4 lg:order-1">
          <h2 id="announcement-list" className="text-xl">
            Annonces publiées
          </h2>
          {announcements.length === 0 ? (
            <EmptyState>Aucune annonce.</EmptyState>
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {announcements.map((a) => {
                const canDelete = a.authorId === user.id || isAdmin(user);
                return (
                  <li key={a.id} className="flex flex-col gap-2 py-4">
                    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                      <h3 className="text-base break-words">{a.title}</h3>
                      {a.pinned && <StatusBadge tone="warn">Épinglée</StatusBadge>}
                    </div>
                    <p className="max-w-prose text-sm break-words whitespace-pre-line">{a.body}</p>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="flex flex-wrap gap-x-4 text-sm text-muted">
                        <span>
                          {a.scope === "GLOBAL"
                            ? "Tout le monde"
                            : a.cohort
                              ? `${a.cohort.name} (${a.cohort.academicYear})`
                              : "Promo supprimée"}
                        </span>
                        <span>{a.authorId === user.id ? "Vous" : a.author.name}</span>
                        <time dateTime={a.createdAt.toISOString()} title={formatDateTime(a.createdAt)}>
                          {timeAgo(a.createdAt, now)}
                        </time>
                      </p>
                      {canDelete && (
                        <ActionForm
                          action={deleteAnnouncement.bind(null, a.id)}
                          confirmMessage={`Supprimer l'annonce « ${a.title} » ? Les notifications déjà envoyées restent.`}
                          className="flex flex-col items-end"
                        >
                          <SubmitButton className="btn btn-ghost text-danger" pendingLabel="Suppression…" aria-label={`Supprimer l'annonce ${a.title}`}>
                            Supprimer
                          </SubmitButton>
                        </ActionForm>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="announcement-new" className="order-1 flex flex-col gap-4 lg:order-2">
          <h2 id="announcement-new" className="text-xl">
            Nouvelle annonce
          </h2>
          <AnnouncementForm action={createAnnouncement} allowGlobal={allowGlobal} cohorts={allowCohort ? cohortOptions : []} />
        </section>
      </div>
    </div>
  );
}
