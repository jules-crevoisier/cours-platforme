import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { assertAllowed, requireUser } from "@/lib/session";
import { canDeleteSae, canManageSae } from "@/lib/permissions";
import { EmptyState, PageHeader, StatusBadge, Tabs } from "@/components/ui";
import {
  addGroupMember,
  addSaeTeacher,
  createCriterion,
  createGroup,
  createMilestone,
  deleteCriterion,
  deleteGroup,
  deleteMilestone,
  deleteSae,
  moveCriterion,
  moveMilestone,
  removeGroupMember,
  removeSaeTeacher,
  renameGroup,
  updateCriterion,
  updateMilestone,
  updateSaeSettings,
} from "../../actions";
import { ActionForm, SubmitButton } from "../../_components/action-form";
import { SaeFields, type CohortOption, type CourseOption } from "../../_components/sae-fields";
import { findCohortOptions, findEditableCourses, loadAcGroups, type AcGroup } from "../../_lib/queries";
import { formatDateTime } from "../../_lib/dates";
import { saeCrumb } from "../../_lib/labels";
import { criterionCode, learningHint, levelForSemester } from "../../_lib/criteria";
import { Checkbox, EditDisclosure, MilestoneFields, MoveButtons } from "./fields";
import { AcOptionsProvider, CriterionFields } from "./criterion-fields";
import { AnnouncementsSection } from "./announcements";
import { AutoGroupsForm, BulkMembersForm } from "./group-formation";
import { DuplicateSection } from "./duplicate-form";

export const metadata: Metadata = { title: "Gérer la SAÉ" };

const plural = (n: number, singular: string, pluralForm = `${singular}s`) => `${n} ${n > 1 ? pluralForm : singular}`;

/** Onglets de la gestion, choisis par `?onglet=` (Infos par défaut) */
const TABS = [
  { key: "infos", label: "Infos" },
  { key: "jalons", label: "Jalons" },
  { key: "groupes", label: "Groupes" },
  { key: "annonces", label: "Annonces" },
  { key: "avance", label: "Avancé" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function loadManagedSae(saeId: string) {
  return db.sae.findUnique({
    where: { id: saeId },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      teachers: { select: { id: true, name: true, email: true }, orderBy: { name: "asc" } },
      course: { select: { id: true, title: true } },
      cohort: { select: { name: true } },
      milestones: {
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        take: 200,
        include: {
          criteria: {
            orderBy: [{ position: "asc" }, { id: "asc" }],
            take: 200,
            include: {
              learning: { select: { code: true, label: true } },
              _count: { select: { items: true } },
            },
          },
          _count: { select: { assessments: true } },
        },
      },
      groups: {
        orderBy: { name: "asc" },
        take: 500,
        include: {
          members: {
            orderBy: { joinedAt: "asc" },
            select: { userId: true, user: { select: { name: true, email: true } } },
          },
          _count: { select: { depositLinks: true } },
        },
      },
      announcements: {
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
        take: 20,
        select: { id: true, title: true, body: true, pinned: true, createdAt: true, author: { select: { name: true } } },
      },
    },
  });
}

type ManagedSae = NonNullable<Awaited<ReturnType<typeof loadManagedSae>>>;

export default async function ManageSaePage({ params, searchParams }: PageProps<"/saes/[saeId]/manage">) {
  const [{ saeId }, query] = await Promise.all([params, searchParams]);
  const tab: TabKey = TABS.find((t) => t.key === query.onglet)?.key ?? "infos";
  const user = await requireUser();

  const sae = await loadManagedSae(saeId);
  if (!sae) notFound();
  assertAllowed(canManageSae(user, sae));

  // Chaque onglet ne charge que ce qu'il affiche
  const [editableCourses, cohorts, acGroups, unassigned] = await Promise.all([
    tab === "infos" ? findEditableCourses(user) : Promise.resolve([]),
    tab === "infos" ? findCohortOptions() : Promise.resolve([]),
    tab === "jalons" ? loadAcGroups() : Promise.resolve([]),
    tab === "groupes" && sae.cohortId
      ? db.cohortMember.count({
          where: {
            cohortId: sae.cohortId,
            user: { role: "STUDENT", memberships: { none: { group: { saeId: sae.id } } } },
          },
        })
      : Promise.resolve(0),
  ]);
  // Le cours actuellement lié reste sélectionnable même si je ne peux pas l'éditer
  const courses: CourseOption[] =
    sae.course && !editableCourses.some((c) => c.id === sae.course?.id)
      ? [sae.course, ...editableCourses]
      : editableCourses;

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-6">
        <PageHeader
          breadcrumbs={[
            { label: "SAÉ", href: "/saes" },
            { label: saeCrumb(sae), href: `/saes/${sae.id}` },
            { label: "Gestion" },
          ]}
          title="Gérer la SAÉ"
          meta={
            (sae.code || !sae.published) && (
              <>
                {sae.code && <span>{sae.title}</span>}
                {!sae.published && <StatusBadge tone="warn">Brouillon</StatusBadge>}
              </>
            )
          }
          actions={
            <Link href={`/saes/${sae.id}`} className="btn">
              Voir la SAÉ
            </Link>
          }
        />
        <Tabs
          label="Gestion de la SAÉ"
          items={TABS.map((t) => ({ href: `?onglet=${t.key}`, label: t.label, active: tab === t.key }))}
        />
      </div>

      {tab === "infos" && <InfosTab sae={sae} courses={courses} cohorts={cohorts} />}
      {tab === "jalons" && <MilestonesTab sae={sae} acGroups={acGroups} />}
      {tab === "groupes" && <GroupsTab sae={sae} unassigned={unassigned} />}
      {tab === "annonces" && <AnnouncementsSection saeId={sae.id} announcements={sae.announcements} />}
      {tab === "avance" && <AdvancedTab sae={sae} canDelete={canDeleteSae(user, sae)} />}
    </div>
  );
}

// ── Infos : champs, publication, équipe pédagogique ─────────────

function InfosTab({ sae, courses, cohorts }: { sae: ManagedSae; courses: CourseOption[]; cohorts: CohortOption[] }) {
  return (
    <div className="flex flex-col gap-10">
      <ActionForm action={updateSaeSettings} className="flex max-w-3xl flex-col gap-4" aria-label="Infos de la SAÉ">
        <input type="hidden" name="saeId" value={sae.id} />
        <SaeFields
          idPrefix="settings"
          courses={courses}
          cohorts={cohorts}
          defaults={{
            code: sae.code,
            title: sae.title,
            semester: sae.semester,
            competences: sae.competences,
            startsAt: sae.startsAt,
            endsAt: sae.endsAt,
            courseId: sae.courseId,
            cohortId: sae.cohortId,
          }}
        />
        <Checkbox id="settings-published" name="published" defaultChecked={sae.published}>
          Publiée
        </Checkbox>
        <div>
          <SubmitButton pendingLabel="Enregistrement…">Enregistrer</SubmitButton>
        </div>
      </ActionForm>

      <section aria-labelledby="equipe" className="flex max-w-3xl flex-col gap-4">
        <h2 id="equipe" className="text-xl">
          Équipe pédagogique
        </h2>
        <ul className="divide-y divide-line">
          <li className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
            <span className="flex min-w-0 flex-wrap gap-x-4">
              <span className="break-words">{sae.owner.name}</span>
              <span className="text-sm break-all text-muted">{sae.owner.email}</span>
            </span>
            <StatusBadge>Responsable</StatusBadge>
          </li>
          {sae.teachers.map((t) => (
            <li key={t.id} className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
              <span className="flex min-w-0 flex-wrap gap-x-4">
                <span className="break-words">{t.name}</span>
                <span className="text-sm break-all text-muted">{t.email}</span>
              </span>
              <ActionForm action={removeSaeTeacher} quiet confirmMessage={`Retirer ${t.name} de l'équipe pédagogique ?`}>
                <input type="hidden" name="saeId" value={sae.id} />
                <input type="hidden" name="userId" value={t.id} />
                <SubmitButton
                  className="btn btn-ghost"
                  pendingLabel="Retrait…"
                  aria-label={`Retirer ${t.name} de l'équipe pédagogique`}
                >
                  Retirer
                </SubmitButton>
              </ActionForm>
            </li>
          ))}
        </ul>
        <ActionForm action={addSaeTeacher} resetOnSuccess aria-label="Ajouter un co-enseignant">
          <input type="hidden" name="saeId" value={sae.id} />
          <label htmlFor="teacher-email" className="label">
            Ajouter un co-enseignant (e-mail)
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="teacher-email"
              name="email"
              type="email"
              required
              maxLength={254}
              autoComplete="off"
              className="input"
              placeholder="prenom.nom@univ.fr"
            />
            <SubmitButton pendingLabel="Ajout…">Ajouter</SubmitButton>
          </div>
        </ActionForm>
      </section>
    </div>
  );
}

// ── Jalons et critères ───────────────────────────────────────────

function MilestonesTab({ sae, acGroups }: { sae: ManagedSae; acGroups: AcGroup[] }) {
  const defaultLevel = levelForSemester(sae.semester);

  return (
    <section aria-labelledby="jalons" className="flex flex-col gap-6">
      <h2 id="jalons" className="sr-only">
        Jalons
      </h2>
      <AcOptionsProvider groups={acGroups}>
        {sae.milestones.length === 0 ? (
          <EmptyState>Aucun jalon.</EmptyState>
        ) : (
          <ol className="divide-y divide-line">
            {sae.milestones.map((m, mIndex) => {
              const deleteWarning =
                `Supprimer le jalon « ${m.title} » ?` +
                (m.criteria.length > 0 || m._count.assessments > 0
                  ? ` Ses ${plural(m.criteria.length, "critère")} et ${plural(
                      m._count.assessments,
                      "auto-évaluation",
                    )} d'étudiants seront définitivement supprimés.`
                  : "");
              return (
                <li key={m.id} className="flex flex-col gap-4 py-6 first:pt-0">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <h3 className="text-lg break-words">
                        <Link href={`/saes/${sae.id}/milestones/${m.id}`} className="hover:underline">
                          {m.title}
                        </Link>
                      </h3>
                      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                        {m.dueAt ? (
                          <time dateTime={m.dueAt.toISOString()}>{formatDateTime(m.dueAt)}</time>
                        ) : (
                          <span>Sans échéance</span>
                        )}
                        {m._count.assessments > 0 && <span>{plural(m._count.assessments, "auto-évaluation")}</span>}
                        {m.requiresDepositUrl && <span>Dépôt d&apos;URL requis</span>}
                        {m.peerReviewEnabled && <span>Évaluation entre pairs</span>}
                      </p>
                    </div>
                    <EditDisclosure
                      summary={
                        <>
                          Modifier<span className="sr-only"> le jalon {m.title}</span>
                        </>
                      }
                      className="open:basis-full"
                    >
                      <div className="flex flex-col gap-6">
                        <ActionForm
                          action={updateMilestone}
                          className="flex max-w-3xl flex-col gap-4"
                          aria-label={`Modifier ${m.title}`}
                        >
                          <input type="hidden" name="milestoneId" value={m.id} />
                          <MilestoneFields
                            idPrefix={`milestone-${m.id}`}
                            defaults={{
                              title: m.title,
                              description: m.description,
                              dueAt: m.dueAt,
                              requiresDepositUrl: m.requiresDepositUrl,
                              peerReviewEnabled: m.peerReviewEnabled,
                            }}
                          />
                          <div>
                            <SubmitButton pendingLabel="Enregistrement…">Enregistrer le jalon</SubmitButton>
                          </div>
                        </ActionForm>
                        <div className="flex flex-wrap items-start gap-2">
                          <MoveButtons
                            action={moveMilestone}
                            idName="milestoneId"
                            idValue={m.id}
                            label={`le jalon ${m.title}`}
                            isFirst={mIndex === 0}
                            isLast={mIndex === sae.milestones.length - 1}
                          />
                          <ActionForm action={deleteMilestone} quiet confirmMessage={deleteWarning}>
                            <input type="hidden" name="milestoneId" value={m.id} />
                            <SubmitButton className="btn btn-danger" pendingLabel="Suppression…">
                              Supprimer le jalon
                            </SubmitButton>
                          </ActionForm>
                        </div>
                      </div>
                    </EditDisclosure>
                  </div>

                  <div className="flex flex-col gap-3">
                    <h4 className="text-sm">Critères</h4>
                    {m.criteria.length === 0 ? (
                      <EmptyState>Aucun critère.</EmptyState>
                    ) : (
                      <ol className="divide-y divide-line">
                        {m.criteria.map((c, cIndex) => {
                          const code = criterionCode(c);
                          const hint = learningHint(c);
                          return (
                            <li key={c.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 py-3">
                              <div className="flex min-w-0 flex-1 flex-col gap-1">
                                <p className="break-words">
                                  {code && (
                                    <span
                                      className="mr-2 font-semibold"
                                      title={c.learning ? "Rattaché au référentiel" : "Code libre"}
                                    >
                                      {code}
                                    </span>
                                  )}
                                  {c.label}
                                </p>
                                {hint && <p className="text-sm break-words text-muted">{hint}</p>}
                                {c.description && (
                                  <p className="text-sm break-words whitespace-pre-line text-muted">{c.description}</p>
                                )}
                              </div>
                              <EditDisclosure
                                summary={
                                  <>
                                    Modifier<span className="sr-only"> le critère {c.label}</span>
                                  </>
                                }
                                className="open:basis-full"
                              >
                                <div className="flex flex-col gap-6">
                                  <ActionForm
                                    action={updateCriterion}
                                    className="flex max-w-3xl flex-col gap-4"
                                    aria-label={`Modifier le critère ${c.label}`}
                                  >
                                    <input type="hidden" name="criterionId" value={c.id} />
                                    <CriterionFields
                                      idPrefix={`criterion-${c.id}`}
                                      defaultLevel={defaultLevel}
                                      defaults={{
                                        label: c.label,
                                        description: c.description,
                                        acCode: c.acCode,
                                        learningId: c.learningId,
                                      }}
                                    />
                                    <div>
                                      <SubmitButton pendingLabel="Enregistrement…">Enregistrer le critère</SubmitButton>
                                    </div>
                                  </ActionForm>
                                  <div className="flex flex-wrap items-start gap-2">
                                    <MoveButtons
                                      action={moveCriterion}
                                      idName="criterionId"
                                      idValue={c.id}
                                      label={`le critère ${c.label}`}
                                      isFirst={cIndex === 0}
                                      isLast={cIndex === m.criteria.length - 1}
                                    />
                                    <ActionForm
                                      action={deleteCriterion}
                                      quiet
                                      confirmMessage={
                                        c._count.items > 0
                                          ? `Attention : ${plural(c._count.items, "positionnement")} d'étudiants sur « ${c.label} » seront définitivement supprimés avec ce critère. Continuer ?`
                                          : `Supprimer le critère « ${c.label} » ?`
                                      }
                                    >
                                      <input type="hidden" name="criterionId" value={c.id} />
                                      <SubmitButton className="btn btn-danger" pendingLabel="Suppression…">
                                        Supprimer le critère
                                      </SubmitButton>
                                    </ActionForm>
                                  </div>
                                </div>
                              </EditDisclosure>
                            </li>
                          );
                        })}
                      </ol>
                    )}
                    <EditDisclosure
                      summary={
                        <>
                          Ajouter un critère<span className="sr-only"> à {m.title}</span>
                        </>
                      }
                    >
                      <ActionForm
                        action={createCriterion}
                        resetOnSuccess
                        className="flex max-w-3xl flex-col gap-4"
                        aria-label={`Ajouter un critère à ${m.title}`}
                      >
                        <input type="hidden" name="milestoneId" value={m.id} />
                        <CriterionFields idPrefix={`new-criterion-${m.id}`} defaultLevel={defaultLevel} />
                        <div>
                          <SubmitButton pendingLabel="Ajout…">Ajouter le critère</SubmitButton>
                        </div>
                      </ActionForm>
                    </EditDisclosure>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </AcOptionsProvider>

      <EditDisclosure summary="Ajouter un jalon">
        <ActionForm
          action={createMilestone}
          resetOnSuccess
          className="flex max-w-3xl flex-col gap-4"
          aria-label="Ajouter un jalon"
        >
          <input type="hidden" name="saeId" value={sae.id} />
          <MilestoneFields idPrefix="new-milestone" />
          <div>
            <SubmitButton pendingLabel="Ajout…">Ajouter le jalon</SubmitButton>
          </div>
        </ActionForm>
      </EditDisclosure>
    </section>
  );
}

// ── Groupes : liste, création manuelle ou automatique ────────────

function GroupsTab({ sae, unassigned }: { sae: ManagedSae; unassigned: number }) {
  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="groupes" className="flex flex-col gap-4">
        <h2 id="groupes" className="sr-only">
          Groupes
        </h2>
        {sae.groups.length === 0 ? (
          <EmptyState>Aucun groupe.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {sae.groups.map((g) => (
              <li key={g.id} className="flex flex-col gap-3 py-6 first:pt-0">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                  <h3 className="min-w-0 flex-1 text-lg break-words">
                    <Link href={`/saes/${sae.id}/groups/${g.id}`} className="hover:underline">
                      {g.name}
                    </Link>
                  </h3>
                  <EditDisclosure
                    summary={
                      <>
                        Modifier<span className="sr-only"> {g.name}</span>
                      </>
                    }
                    className="open:basis-full"
                  >
                    <div className="grid max-w-3xl gap-6 md:grid-cols-2">
                      <ActionForm action={addGroupMember} resetOnSuccess aria-label={`Ajouter un membre à ${g.name}`}>
                        <input type="hidden" name="groupId" value={g.id} />
                        <label htmlFor={`member-email-${g.id}`} className="label">
                          Ajouter un étudiant (e-mail)
                        </label>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <input
                            id={`member-email-${g.id}`}
                            name="email"
                            type="email"
                            required
                            maxLength={254}
                            autoComplete="off"
                            className="input"
                            placeholder="etudiant@univ.fr"
                          />
                          <SubmitButton pendingLabel="Ajout…">Ajouter</SubmitButton>
                        </div>
                      </ActionForm>
                      <ActionForm action={renameGroup} aria-label={`Renommer ${g.name}`}>
                        <input type="hidden" name="groupId" value={g.id} />
                        <label htmlFor={`group-name-${g.id}`} className="label">
                          Nom du groupe
                        </label>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <input
                            id={`group-name-${g.id}`}
                            name="name"
                            required
                            maxLength={100}
                            className="input"
                            defaultValue={g.name}
                          />
                          <SubmitButton pendingLabel="Enregistrement…">Renommer</SubmitButton>
                        </div>
                      </ActionForm>
                      <div className="md:col-span-2">
                        <BulkMembersForm groupId={g.id} groupName={g.name} />
                      </div>
                      <ActionForm
                        action={deleteGroup}
                        quiet
                        className="md:col-span-2"
                        confirmMessage={
                          `Supprimer le groupe « ${g.name} » ?` +
                          (g._count.depositLinks > 0
                            ? ` Ses ${plural(g._count.depositLinks, "URL de dépôt", "URL de dépôt")} seront supprimées.`
                            : "") +
                          " Les auto-évaluations des membres sont conservées."
                        }
                      >
                        <input type="hidden" name="groupId" value={g.id} />
                        <SubmitButton className="btn btn-danger" pendingLabel="Suppression…">
                          Supprimer le groupe
                        </SubmitButton>
                      </ActionForm>
                    </div>
                  </EditDisclosure>
                </div>

                {g.members.length === 0 ? (
                  <EmptyState>Aucun membre.</EmptyState>
                ) : (
                  <ul className="divide-y divide-line">
                    {g.members.map((member) => (
                      <li
                        key={member.userId}
                        className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-1"
                      >
                        <span className="flex min-w-0 flex-wrap gap-x-4">
                          <span className="break-words">{member.user.name}</span>
                          <span className="text-sm break-all text-muted">{member.user.email}</span>
                        </span>
                        <ActionForm
                          action={removeGroupMember}
                          quiet
                          confirmMessage={`Retirer ${member.user.name} du groupe « ${g.name} » ?`}
                        >
                          <input type="hidden" name="groupId" value={g.id} />
                          <input type="hidden" name="userId" value={member.userId} />
                          <SubmitButton
                            className="btn btn-ghost"
                            pendingLabel="Retrait…"
                            aria-label={`Retirer ${member.user.name} du groupe ${g.name}`}
                          >
                            Retirer
                          </SubmitButton>
                        </ActionForm>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="creer-groupes" className="flex flex-col gap-4">
        <h2 id="creer-groupes" className="text-xl">
          Créer des groupes
        </h2>
        <div className="grid max-w-3xl gap-8 md:grid-cols-2">
          <ActionForm action={createGroup} resetOnSuccess aria-label="Créer un groupe">
            <input type="hidden" name="saeId" value={sae.id} />
            <label htmlFor="new-group-name" className="label">
              Nouveau groupe
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="new-group-name"
                name="name"
                required
                maxLength={100}
                className="input"
                placeholder="Groupe A"
              />
              <SubmitButton pendingLabel="Création…">Créer</SubmitButton>
            </div>
          </ActionForm>
          <AutoGroupsForm saeId={sae.id} cohort={sae.cohort} unassigned={unassigned} />
        </div>
      </section>
    </div>
  );
}

// ── Avancé : export, duplication, suppression ────────────────────

function AdvancedTab({ sae, canDelete }: { sae: ManagedSae; canDelete: boolean }) {
  return (
    <div className="flex max-w-3xl flex-col gap-10">
      <section aria-labelledby="exporter" className="flex flex-col gap-4">
        <h2 id="exporter" className="text-xl">
          Exporter
        </h2>
        <div>
          {/* Route handler (téléchargement) : lien natif, pas de navigation client */}
          <a href={`/saes/${sae.id}/export`} className="btn" download>
            Exporter le suivi (CSV)
          </a>
        </div>
      </section>

      <DuplicateSection saeId={sae.id} />

      {canDelete && (
        <section aria-labelledby="supprimer" className="card flex flex-col gap-4 border-danger">
          <h2 id="supprimer" className="text-xl">
            Supprimer
          </h2>
          <ActionForm
            action={deleteSae}
            confirmMessage={`Supprimer définitivement « ${sae.title} » et toutes ses données ? Cette action est irréversible.`}
          >
            <input type="hidden" name="saeId" value={sae.id} />
            <SubmitButton className="btn btn-danger" pendingLabel="Suppression…">
              Supprimer la SAÉ
            </SubmitButton>
          </ActionForm>
        </section>
      )}
    </div>
  );
}
