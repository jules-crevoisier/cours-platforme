import type { Metadata } from "next";
import { showcaseSnapshot } from "@/app/vitrine/_lib/showcase";
import { getPeertubeHosts } from "@/components/editor/peertube";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { assertAllowed, requireUser } from "@/lib/session";
import {
  canContributeToGroup,
  canManageSae,
  canPublishShowcase,
  canRequestShowcase,
  canViewAssessment,
  canViewSae,
  isGroupMember,
} from "@/lib/permissions";
import { PROVIDER_LABELS } from "@/lib/deposit";
import { formatDate, formatDateTime, formatTime } from "@/lib/format";
import { AssessmentStatusBadge, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { LinkStatusBadge } from "@/app/assessments/_lib/ui";
import { BlockEditor } from "@/components/editor";
import { publicName } from "@/app/me/portfolio/_lib/shared";
import { ActionButton } from "@/app/me/portfolio/_components/action-button";
import { ExternalLink } from "@/app/me/portfolio/_components/ui";
import { ShowcaseCard } from "@/app/vitrine/_components/showcase-card";
import { ModerationControls } from "@/app/vitrine/_components/moderation-controls";
import { cancelShowcaseRequest, moderateShowcase, requestShowcase } from "@/app/vitrine/actions";
import {
  addDepositLink,
  checkAllDepositLinks,
  checkDepositLink,
  deleteDepositLink,
  saveGroupContent,
} from "./actions";
import { DepositForm } from "./deposit-form";
import { ShowcaseForm } from "./showcase-form";

export const metadata: Metadata = { title: "Espace de groupe" };

export default async function GroupPage({ params }: PageProps<"/saes/[saeId]/groups/[groupId]">) {
  const { saeId, groupId } = await params;
  const user = await requireUser();

  const group = await db.group.findUnique({
    where: { id: groupId },
    include: {
      sae: {
        select: {
          id: true,
          code: true,
          title: true,
          semester: true,
          ownerId: true,
          published: true,
          teachers: { select: { id: true } },
          milestones: {
            orderBy: [{ position: "asc" }, { dueAt: "asc" }],
            take: 100,
            select: { id: true, title: true, dueAt: true, requiresDepositUrl: true },
          },
        },
      },
      members: {
        orderBy: { joinedAt: "asc" },
        select: { userId: true, user: { select: { id: true, name: true } } },
      },
      depositLinks: {
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          id: true,
          url: true,
          label: true,
          provider: true,
          milestoneId: true,
          addedById: true,
          createdAt: true,
          checkedAt: true,
          checkStatus: true,
          checkHttp: true,
          checkNote: true,
          addedBy: { select: { name: true } },
        },
      },
      defenseSlot: {
        select: { startsAt: true, durationMin: true, location: true, jury: true },
      },
    },
  });
  if (!group || group.saeId !== saeId) notFound();

  const { sae } = group;
  assertAllowed(canViewSae(user, sae) && (isGroupMember(user, group) || canManageSae(user, sae)));

  const isManager = canManageSae(user, sae);
  const canContribute = canContributeToGroup(user, group, sae);
  const canRequest = canRequestShowcase(user, group);
  const canModerate = canPublishShowcase(user, sae);
  const memberIds = group.members.map((m) => m.userId);

  // Auto-évaluations des membres sur les jalons de cette SAÉ (quel que soit le groupe enregistré)
  const assessments = await db.selfAssessment.findMany({
    where: { userId: { in: memberIds }, milestone: { saeId: sae.id } },
    take: 1000,
    select: {
      id: true,
      userId: true,
      milestoneId: true,
      status: true,
      group: { select: { members: { select: { userId: true } } } },
    },
  });
  const assessmentByKey = new Map(assessments.map((a) => [`${a.milestoneId}:${a.userId}`, a]));

  // Jalons ayant des liens ou en attendant (dépôt requis), puis les liens « Général »
  const linkSections = [
    ...sae.milestones.map((m) => ({
      key: m.id,
      title: m.title,
      requiresDepositUrl: m.requiresDepositUrl,
      links: group.depositLinks.filter((l) => l.milestoneId === m.id),
    })),
    {
      key: "general",
      title: "Général",
      requiresDepositUrl: false,
      links: group.depositLinks.filter((l) => !l.milestoneId || !sae.milestones.some((m) => m.id === l.milestoneId)),
    },
  ].filter((section) => section.links.length > 0 || section.requiresDepositUrl);
  const linkCount = group.depositLinks.length;

  const slot = group.defenseSlot;
  const showcaseStatus = group.showcaseStatus;
  const showcaseInitial = {
    title: group.showcaseTitle ?? "",
    summary: group.showcaseSummary ?? "",
    url: group.showcaseUrl ?? "",
    imageUrl: group.showcaseImageUrl ?? "",
    category: group.showcaseCategory ?? "",
  };

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        breadcrumbs={[
          { label: "SAÉ", href: "/saes" },
          { label: sae.code ?? sae.title, href: `/saes/${sae.id}` },
          { label: group.name },
        ]}
        title={group.name}
        meta={
          group.members.length === 0 ? (
            <span>Aucun membre</span>
          ) : (
            <>
              <span className="sr-only">Membres :</span>
              {group.members.map((m) => (
                <span key={m.userId} className="break-words">
                  {m.user.name}
                  {m.userId === user.id ? " (vous)" : ""}
                </span>
              ))}
            </>
          )
        }
      />

      {slot && (
        <section aria-labelledby="defense-title" className="flex flex-col gap-2">
          <h2 id="defense-title" className="text-xl">
            Soutenance
          </h2>
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            <time dateTime={slot.startsAt.toISOString()} className="font-semibold">
              {formatDate(slot.startsAt)}
            </time>
            <span>
              {formatTime(slot.startsAt)} – {formatTime(new Date(slot.startsAt.getTime() + slot.durationMin * 60_000))}
            </span>
            {slot.location && <span className="break-words">{slot.location}</span>}
          </p>
          {slot.jury && (
            <p className="text-sm">
              <span className="text-muted">Jury : </span>
              <span className="break-words whitespace-pre-line">{slot.jury}</span>
            </p>
          )}
          <Link href={`/saes/${sae.id}/defenses`} className="link inline-flex min-h-11 items-center self-start text-sm">
            Planning des soutenances
          </Link>
        </section>
      )}

      <section aria-labelledby="workspace-title" className="flex flex-col gap-3">
        <h2 id="workspace-title" className="text-xl">
          Espace de travail
        </h2>
        <BlockEditor
          initialContent={group.content}
          initialMarkdown={group.markdown}
          editable={canContribute}
          onSave={canContribute ? saveGroupContent.bind(null, group.id) : undefined}
          peertubeHosts={getPeertubeHosts()}
        />
      </section>

      <section id="depots" aria-labelledby="deposits-title" className="flex scroll-mt-4 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="deposits-title" className="text-xl">
            Dépôts
          </h2>
          {canContribute && linkCount > 0 && (
            <ActionButton
              action={checkAllDepositLinks.bind(null, group.id)}
              label="Tout vérifier"
              pendingLabel="Vérification des liens…"
              showSuccess
            />
          )}
        </div>

        {linkSections.length === 0 ? (
          <EmptyState>Aucune URL déposée.</EmptyState>
        ) : (
          <div className="flex flex-col gap-6">
            {linkSections.map((section) => (
              <div key={section.key} className="flex flex-col gap-1">
                <h3 className="text-base break-words">{section.title}</h3>
                {section.links.length === 0 ? (
                  <p className="text-sm text-danger">Aucune URL déposée (requise).</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-line">
                    {section.links.map((link) => {
                      const canDelete = isManager || (canContribute && link.addedById === user.id);
                      const providerLabel = PROVIDER_LABELS[link.provider];
                      const name = link.label ?? providerLabel;
                      return (
                        <li key={link.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
                          <span
                            className="flex min-h-11 min-w-0 flex-1 basis-48 items-center"
                            title={`${providerLabel} — ajouté par ${link.addedBy.name} le ${formatDateTime(link.createdAt)}`}
                          >
                            <ExternalLink href={link.url} className="link break-all">
                              {link.label ?? link.url}
                            </ExternalLink>
                          </span>
                          <LinkStatusBadge
                            status={link.checkStatus}
                            checkedAt={link.checkedAt}
                            note={link.checkNote}
                            http={link.checkHttp}
                          />
                          {(canContribute || canDelete) && (
                            <details className="w-full sm:w-auto">
                              <summary className="btn btn-ghost list-none [&::-webkit-details-marker]:hidden">
                                Options<span className="sr-only"> du lien {name}</span>
                              </summary>
                              <div className="flex flex-wrap items-start gap-2 pt-2">
                                {canContribute && (
                                  <ActionButton
                                    action={checkDepositLink.bind(null, link.id)}
                                    label="Vérifier"
                                    pendingLabel="Vérification…"
                                    ariaLabel={`Vérifier le lien ${name}`}
                                    showSuccess
                                  />
                                )}
                                {canDelete && (
                                  <ActionButton
                                    action={deleteDepositLink.bind(null, link.id)}
                                    label="Supprimer"
                                    pendingLabel="Suppression…"
                                    confirmMessage="Supprimer ce lien de dépôt ?"
                                    ariaLabel={`Supprimer le lien ${name}`}
                                    variant="danger"
                                  />
                                )}
                              </div>
                            </details>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        {canContribute && (
          <DepositForm
            action={addDepositLink.bind(null, group.id)}
            milestones={sae.milestones.map((m) => ({ id: m.id, title: m.title }))}
          />
        )}
      </section>

      <section id="vitrine" aria-labelledby="showcase-title" className="flex scroll-mt-4 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <h2 id="showcase-title" className="text-xl">
            Vitrine
          </h2>
          {showcaseStatus === "PENDING" && <StatusBadge tone="warn">En attente de validation</StatusBadge>}
          {showcaseStatus === "PUBLISHED" && <StatusBadge tone="ok">Publié</StatusBadge>}
        </div>

        {showcaseStatus === "NONE" && !canRequest ? (
          <p className="text-muted">Projet non proposé.</p>
        ) : (
          <details open={canModerate && showcaseStatus === "PENDING" ? true : undefined}>
            <summary className="btn list-none [&::-webkit-details-marker]:hidden">
              {showcaseStatus === "NONE" ? "Publier dans la vitrine" : "Voir la proposition"}
            </summary>
            <div className="pt-4">
              {showcaseStatus === "NONE" ? (
                <ShowcaseForm
                  action={requestShowcase.bind(null, group.id)}
                  initial={showcaseInitial}
                  isUpdate={false}
                  isPublished={false}
                />
              ) : (
                <div className="grid gap-6 md:grid-cols-2 md:items-start">
                  <ShowcaseCard
                    headingLevel="h3"
                    title={group.showcaseTitle ?? "Projet sans titre"}
                    summary={group.showcaseSummary}
                    url={group.showcaseUrl}
                    imageUrl={group.showcaseImageUrl}
                    category={group.showcaseCategory}
                    saeCode={sae.code}
                    saeTitle={sae.title}
                    semester={sae.semester}
                    members={group.members.map((m) => publicName(m.user.name))}
                  />

                  <div className="flex flex-col gap-4">
                    {canModerate && (showcaseStatus === "PENDING" || showcaseStatus === "PUBLISHED") && (
                      <div className="flex flex-col gap-2">
                        <h3 className="text-base">Décision</h3>
                        <ModerationControls
                          status={showcaseStatus}
                          groupName={group.name}
                          action={moderateShowcase.bind(null, group.id, showcaseSnapshot(group))}
                        />
                      </div>
                    )}
                    {canRequest && (
                      <div className="flex flex-col gap-3">
                        {showcaseStatus === "PENDING" && (
                          <ActionButton
                            action={cancelShowcaseRequest.bind(null, group.id)}
                            label="Annuler la demande"
                            pendingLabel="Annulation…"
                            confirmMessage="Annuler la demande de publication dans la vitrine ?"
                            variant="ghost"
                          />
                        )}
                        <details>
                          <summary className="btn list-none [&::-webkit-details-marker]:hidden">
                            Modifier la proposition
                          </summary>
                          <div className="pt-4">
                            <ShowcaseForm
                              action={requestShowcase.bind(null, group.id)}
                              initial={showcaseInitial}
                              isUpdate
                              isPublished={showcaseStatus === "PUBLISHED"}
                            />
                          </div>
                        </details>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </details>
        )}
      </section>

      {sae.milestones.length > 0 && group.members.length > 0 && (
        <section aria-labelledby="assessments-title" className="flex flex-col gap-4">
          <h2 id="assessments-title" className="text-xl">
            Auto-évaluations
          </h2>
          {sae.milestones.map((milestone) => (
            <div key={milestone.id} className="flex flex-col gap-1">
              <h3 className="text-base">
                <Link href={`/saes/${sae.id}/milestones/${milestone.id}`} className="break-words hover:underline">
                  {milestone.title}
                </Link>
              </h3>
              <ul className="flex flex-col divide-y divide-line">
                {group.members.map((member) => {
                  const assessment = assessmentByKey.get(`${milestone.id}:${member.userId}`);
                  const viewable =
                    !!assessment &&
                    canViewAssessment(
                      user,
                      { userId: assessment.userId, status: assessment.status, group: assessment.group },
                      sae,
                    );
                  return (
                    <li key={member.userId} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-1">
                      <span className="mr-auto break-words">{member.user.name}</span>
                      <AssessmentStatusBadge status={assessment?.status ?? "NONE"} />
                      {assessment && viewable && (
                        <Link
                          href={`/assessments/${assessment.id}`}
                          className="link inline-flex min-h-11 items-center"
                          aria-label={`Voir l'auto-évaluation de ${member.user.name} — ${milestone.title}`}
                        >
                          Voir
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
