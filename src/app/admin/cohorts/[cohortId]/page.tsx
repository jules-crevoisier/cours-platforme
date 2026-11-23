import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { assertAllowed, requireUser } from "@/lib/session";
import { ROLE_LABELS, canManageCohorts } from "@/lib/permissions";
import { EmptyState, PageHeader } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/app/admin/users/_components/action-form";
import { addMembers, deleteCohort, removeMember, updateCohort } from "../actions";
import { CohortForm } from "../_components/cohort-form";
import { MAX_EMAILS_PER_PASTE, PARCOURS_OPTIONS, parcoursLabel } from "../_lib/cohorts";

export const metadata: Metadata = { title: "Promo" };

const MEMBERS_LIMIT = 500;

export default async function CohortPage({ params }: PageProps<"/admin/cohorts/[cohortId]">) {
  const user = await requireUser();
  assertAllowed(canManageCohorts(user));
  const { cohortId } = await params;

  const cohort = await db.cohort.findUnique({
    where: { id: cohortId },
    select: {
      id: true,
      name: true,
      year: true,
      parcours: true,
      academicYear: true,
      _count: { select: { members: true, saes: true, announcements: true } },
      members: {
        select: { user: { select: { id: true, name: true, email: true, role: true } } },
        orderBy: { user: { name: "asc" } },
        take: MEMBERS_LIMIT,
      },
    },
  });
  if (!cohort) notFound();

  const count = cohort._count.members;
  const announcements = cohort._count.announcements;

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        breadcrumbs={[{ label: "Promos", href: "/admin/cohorts" }, { label: cohort.name }]}
        title={cohort.name}
        meta={
          <>
            <span>{cohort.academicYear}</span>
            <span>BUT {cohort.year}</span>
            <span>{parcoursLabel(cohort.parcours)}</span>
            <span>
              {count} membre{count > 1 ? "s" : ""}
            </span>
            {cohort._count.saes > 0 && (
              <span>
                {cohort._count.saes} SAÉ liée{cohort._count.saes > 1 ? "s" : ""}
              </span>
            )}
          </>
        }
      />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <section aria-labelledby="members-title" className="flex min-w-0 flex-col gap-4">
          <h2 id="members-title" className="text-xl">
            Membres
          </h2>
          {cohort.members.length === 0 ? (
            <EmptyState>Aucun membre.</EmptyState>
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {cohort.members.map(({ user: m }) => (
                <li key={m.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-3">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium break-words">
                      {m.name}
                      {m.role !== "STUDENT" && <span className="badge ml-2">{ROLE_LABELS[m.role]}</span>}
                    </span>
                    <span className="text-sm break-all text-muted">{m.email}</span>
                  </div>
                  <ActionForm
                    action={removeMember.bind(null, cohort.id, m.id)}
                    confirmMessage={`Retirer ${m.name} de la promo « ${cohort.name} » ?`}
                    className="flex flex-col items-start"
                  >
                    <SubmitButton className="btn btn-ghost" pendingLabel="Retrait…" aria-label={`Retirer ${m.name} de la promo`}>
                      Retirer
                    </SubmitButton>
                  </ActionForm>
                </li>
              ))}
            </ul>
          )}
          {count > cohort.members.length && (
            <p className="text-sm text-muted">
              {cohort.members.length} premiers sur {count}.
            </p>
          )}
        </section>

        <div className="flex flex-col gap-10">
          <section aria-labelledby="add-title" className="flex flex-col gap-4">
            <h2 id="add-title" className="text-xl">
              Ajouter des membres
            </h2>
            <ActionForm action={addMembers.bind(null, cohort.id)} resetOnSuccess className="flex flex-col gap-3">
              <div>
                <label htmlFor="cohort-emails" className="label">
                  Adresses e-mail
                </label>
                <textarea
                  id="cohort-emails"
                  name="emails"
                  required
                  rows={6}
                  maxLength={40_000}
                  spellCheck={false}
                  autoComplete="off"
                  className="input text-sm"
                  aria-describedby="cohort-emails-hint"
                />
                <p id="cohort-emails-hint" className="mt-1 text-sm text-muted">
                  Une par ligne, {MAX_EMAILS_PER_PASTE} au maximum.
                </p>
              </div>
              <div>
                <SubmitButton pendingLabel="Ajout…">Ajouter à la promo</SubmitButton>
              </div>
            </ActionForm>
          </section>

          <details>
            <summary className="btn cursor-pointer list-none [&::-webkit-details-marker]:hidden">Modifier la promo</summary>
            <div className="mt-4 flex flex-col gap-6">
              <CohortForm
                action={updateCohort.bind(null, cohort.id)}
                parcoursOptions={PARCOURS_OPTIONS}
                initial={{ name: cohort.name, year: cohort.year, parcours: cohort.parcours, academicYear: cohort.academicYear }}
                submitLabel="Enregistrer"
                pendingLabel="Enregistrement…"
              />
              <ActionForm
                action={deleteCohort.bind(null, cohort.id)}
                confirmMessage={`Supprimer définitivement la promo « ${cohort.name} » ? Les comptes des membres sont conservés${
                  announcements > 0 ? `, ses ${announcements} annonce${announcements > 1 ? "s" : ""} seront supprimées` : ""
                }${cohort._count.saes > 0 ? ", les SAÉ liées seront détachées" : ""}.`}
                className="border-t border-line pt-6"
              >
                <SubmitButton className="btn btn-danger" pendingLabel="Suppression…">
                  Supprimer la promo
                </SubmitButton>
              </ActionForm>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
