import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState, MilestoneSteps, PageHeader, StatusBadge, type MilestoneStatus } from "@/components/ui";
import { getPeertubeHosts } from "@/components/editor/peertube";
import { db } from "@/lib/db";
import { assertAllowed, requireUser } from "@/lib/session";
import { canManageSae, canViewCourse, canViewSae, isGroupMember } from "@/lib/permissions";
import { formatDateTime, timeAgo } from "@/lib/format";
import { isFavorite } from "@/lib/favorites";
import { BlockEditor } from "@/components/editor";
import { FavoriteButton } from "@/components/favorite-button";
import { saveSaeContent } from "../actions";
import { formatDateRange } from "../_lib/dates";
import { saeCrumb } from "../_lib/labels";

export const metadata: Metadata = { title: "SAÉ" };

export default async function SaePage({ params }: PageProps<"/saes/[saeId]">) {
  const { saeId } = await params;
  const user = await requireUser();

  const sae = await db.sae.findUnique({
    where: { id: saeId },
    include: {
      owner: { select: { id: true, name: true } },
      teachers: { select: { id: true, name: true }, orderBy: { name: "asc" } },
      course: {
        select: { slug: true, title: true, published: true, ownerId: true, editors: { select: { id: true } } },
      },
      cohort: { select: { name: true } },
      milestones: {
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        take: 200,
        select: { id: true, title: true, dueAt: true },
      },
      groups: {
        orderBy: { name: "asc" },
        take: 500,
        select: {
          id: true,
          name: true,
          members: {
            orderBy: { joinedAt: "asc" },
            select: { userId: true, user: { select: { name: true } } },
          },
        },
      },
      announcements: {
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
        take: 5,
        select: { id: true, title: true, body: true, pinned: true, createdAt: true, author: { select: { name: true } } },
      },
      _count: { select: { defenseSlots: true } },
    },
  });
  if (!sae) notFound();
  assertAllowed(canViewSae(user, sae));

  const canManage = canManageSae(user, sae);
  const myGroup = sae.groups.find((g) => isGroupMember(user, g));
  const range = formatDateRange(sae.startsAt, sae.endsAt);
  const hasSubject = (Array.isArray(sae.content) && sae.content.length > 0) || !!sae.markdown;
  const now = new Date();
  // Statut personnel des jalons : seulement pour un étudiant placé dans un groupe (auto-évaluation)
  const personal = !!myGroup && !canManage;

  const [favorite, mySubmissions, mySlot, takenSlots] = await Promise.all([
    isFavorite(user.id, "SAE", sae.id),
    personal
      ? db.selfAssessment.findMany({
          where: { userId: user.id, status: "SUBMITTED", milestone: { saeId: sae.id } },
          select: { milestoneId: true },
          take: 200,
        })
      : Promise.resolve([]),
    myGroup
      ? db.defenseSlot.findUnique({
          where: { groupId: myGroup.id },
          select: { startsAt: true, durationMin: true, location: true },
        })
      : Promise.resolve(null),
    canManage && sae._count.defenseSlots > 0
      ? db.defenseSlot.count({ where: { saeId: sae.id, groupId: { not: null } } })
      : Promise.resolve(0),
  ]);

  const submittedByMe = new Set(mySubmissions.map((s) => s.milestoneId));
  const milestoneStatus = (m: { id: string; dueAt: Date | null }): MilestoneStatus => {
    if (!personal) return "none";
    if (submittedByMe.has(m.id)) return "done";
    return m.dueAt && m.dueAt < now ? "late" : "pending";
  };

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        breadcrumbs={[{ label: "SAÉ", href: "/saes" }, { label: saeCrumb(sae) }]}
        title={sae.title}
        meta={
          (sae.semester || sae.cohort || range || !sae.published) && (
            <>
              {sae.semester && <span>Semestre {sae.semester}</span>}
              {sae.cohort && <span>{sae.cohort.name}</span>}
              {range && <span>{range}</span>}
              {!sae.published && <StatusBadge tone="warn">Brouillon</StatusBadge>}
            </>
          )
        }
        actions={
          <>
            <FavoriteButton kind="SAE" targetId={sae.id} initial={favorite} label="cette SAÉ" />
            {canManage && (
              <Link href={`/saes/${sae.id}/manage`} className="btn btn-primary">
                Gérer
              </Link>
            )}
          </>
        }
      />

      <dl className="grid gap-x-8 gap-y-3 md:grid-cols-2">
        {myGroup && (
          <div>
            <dt className="text-sm font-semibold">Mon groupe</dt>
            <dd>
              <Link href={`/saes/${sae.id}/groups/${myGroup.id}`} className="link font-semibold break-words">
                {myGroup.name}
              </Link>
            </dd>
          </div>
        )}
        <div>
          <dt className="text-sm font-semibold">Équipe pédagogique</dt>
          <dd className="text-muted">{[sae.owner.name, ...sae.teachers.map((t) => t.name)].join(", ")}</dd>
        </div>
        {sae.course && (
          <div>
            <dt className="text-sm font-semibold">Cours lié</dt>
            <dd>
              {canViewCourse(user, sae.course) ? (
                <Link href={`/courses/${sae.course.slug}`} className="link break-words">
                  {sae.course.title}
                </Link>
              ) : (
                <span className="break-words text-muted">{sae.course.title}</span>
              )}
            </dd>
          </div>
        )}
        {sae.competences && (
          <div className="md:col-span-2">
            <dt className="text-sm font-semibold">Compétences visées</dt>
            <dd className="break-words whitespace-pre-line text-muted">{sae.competences}</dd>
          </div>
        )}
      </dl>

      {sae.announcements.length > 0 && (
        <section aria-labelledby="annonces" className="flex flex-col gap-4">
          <h2 id="annonces" className="text-xl">
            Annonces
          </h2>
          <ul className="divide-y divide-line">
            {sae.announcements.map((a) => (
              <li key={a.id} className="flex flex-col gap-1 py-4 first:pt-0">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <p className="font-semibold break-words">{a.title}</p>
                  {a.pinned && <StatusBadge>Épinglée</StatusBadge>}
                </div>
                <p className="flex flex-wrap gap-x-4 text-sm text-muted">
                  <span>{a.author.name}</span>
                  <time dateTime={a.createdAt.toISOString()} title={formatDateTime(a.createdAt)}>
                    {timeAgo(a.createdAt, now)}
                  </time>
                </p>
                <p className="max-w-prose break-words whitespace-pre-line">{a.body}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="jalons" className="flex flex-col gap-4">
        <h2 id="jalons" className="text-xl">
          Jalons
        </h2>
        {sae.milestones.length === 0 ? (
          <EmptyState>Aucun jalon.</EmptyState>
        ) : (
          <MilestoneSteps
            label={`Jalons de ${sae.code ?? "la SAÉ"}`}
            now={now}
            statusLabels={{ done: "Soumise" }}
            milestones={sae.milestones.map((m) => ({
              id: m.id,
              title: m.title,
              dueAt: m.dueAt,
              href: `/saes/${sae.id}/milestones/${m.id}`,
              status: milestoneStatus(m),
            }))}
          />
        )}
      </section>

      {(sae._count.defenseSlots > 0 || canManage) && (
        <section aria-labelledby="soutenances" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="soutenances" className="text-xl">
              Soutenances
            </h2>
            <Link href={`/saes/${sae.id}/defenses`} className="btn">
              {canManage ? "Gérer les créneaux" : myGroup && !mySlot ? "Réserver un créneau" : "Voir les créneaux"}
            </Link>
          </div>
          {canManage ? (
            <p className="text-muted">
              {sae._count.defenseSlots === 0
                ? "Aucun créneau."
                : `Créneaux attribués : ${takenSlots} sur ${sae._count.defenseSlots}`}
            </p>
          ) : mySlot ? (
            <p className="flex flex-wrap gap-x-4">
              <time dateTime={mySlot.startsAt.toISOString()} className="font-semibold">
                {formatDateTime(mySlot.startsAt)}
              </time>
              <span className="text-muted">{mySlot.durationMin} min</span>
              {mySlot.location && <span className="text-muted">{mySlot.location}</span>}
            </p>
          ) : myGroup ? (
            <p className="text-muted">Aucun créneau réservé.</p>
          ) : null}
        </section>
      )}

      <section aria-labelledby="sujet" className="flex flex-col gap-4">
        <h2 id="sujet" className="text-xl">
          Sujet
        </h2>
        {hasSubject || canManage ? (
          <BlockEditor
            initialContent={sae.content}
            initialMarkdown={sae.markdown}
            editable={canManage}
            onSave={canManage ? saveSaeContent.bind(null, sae.id) : undefined}
            peertubeHosts={getPeertubeHosts()}
          />
        ) : (
          <EmptyState>Sujet non rédigé.</EmptyState>
        )}
      </section>

      <section aria-labelledby="groupes" className="flex flex-col gap-4">
        <h2 id="groupes" className="text-xl">
          Groupes
        </h2>
        {sae.groups.length === 0 ? (
          <EmptyState>Aucun groupe.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {sae.groups.map((g) => {
              const members = g.members.length === 0 ? "Aucun membre" : g.members.map((m) => m.user.name).join(", ");
              return (
                <li key={g.id} className="flex flex-col gap-0.5 py-3 first:pt-0">
                  {/* L'équipe ouvre chaque groupe ; l'étudiant a déjà le lien vers le sien (« Mon groupe ») */}
                  {canManage ? (
                    <Link href={`/saes/${sae.id}/groups/${g.id}`} className="self-start font-semibold break-words hover:underline">
                      {g.name}
                    </Link>
                  ) : (
                    <span className="font-semibold break-words">{g.name}</span>
                  )}
                  <span className="text-sm break-words text-muted">{members}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
