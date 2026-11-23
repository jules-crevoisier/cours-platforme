import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { assertAllowed, requireUser } from "@/lib/session";
import { canManageCohorts } from "@/lib/permissions";
import { EmptyState, PageHeader } from "@/components/ui";
import { createCohort } from "./actions";
import { CohortForm } from "./_components/cohort-form";
import { PARCOURS_OPTIONS, currentAcademicYear, parcoursLabel } from "./_lib/cohorts";

export const metadata: Metadata = { title: "Promos" };

export default async function CohortsPage() {
  const user = await requireUser();
  assertAllowed(canManageCohorts(user));

  const cohorts = await db.cohort.findMany({
    select: {
      id: true,
      name: true,
      year: true,
      parcours: true,
      academicYear: true,
      _count: { select: { members: true, saes: true } },
    },
    orderBy: [{ academicYear: "desc" }, { year: "asc" }, { name: "asc" }],
    take: 300,
  });

  const byYear = new Map<string, typeof cohorts>();
  for (const c of cohorts) byYear.set(c.academicYear, [...(byYear.get(c.academicYear) ?? []), c]);
  const thisYear = currentAcademicYear();

  return (
    <div className="flex flex-col gap-10">
      <PageHeader title="Promos" />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <section aria-label="Liste des promos" className="flex min-w-0 flex-col gap-6">
          {cohorts.length === 0 ? (
            <EmptyState>Aucune promo.</EmptyState>
          ) : (
            [...byYear.entries()].map(([academicYear, list]) => (
              <div key={academicYear} className="flex flex-col gap-2">
                <h2 className="flex flex-wrap gap-x-3 text-sm font-semibold text-muted">
                  <span>{academicYear}</span>
                  {academicYear === thisYear && <span className="font-normal">en cours</span>}
                </h2>
                <ul className="divide-y divide-line border-y border-line">
                  {list.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/admin/cohorts/${c.id}`}
                        className="flex min-h-11 flex-col gap-1 px-2 py-3 hover:bg-sunken sm:flex-row sm:items-center sm:gap-4"
                      >
                        <span className="min-w-0 font-medium break-words sm:flex-1">{c.name}</span>
                        <span className="flex flex-wrap items-center gap-x-4 text-sm text-muted">
                          <span>BUT {c.year}</span>
                          <span>{parcoursLabel(c.parcours)}</span>
                          <span>
                            {c._count.members} membre{c._count.members > 1 ? "s" : ""}
                          </span>
                          {c._count.saes > 0 && <span>{c._count.saes} SAÉ</span>}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>

        <section aria-labelledby="cohort-new" className="flex flex-col gap-4">
          <h2 id="cohort-new" className="text-xl">
            Nouvelle promo
          </h2>
          <CohortForm
            action={createCohort}
            parcoursOptions={PARCOURS_OPTIONS}
            initial={{ name: "", year: 1, parcours: null, academicYear: thisYear }}
            submitLabel="Créer la promo"
            pendingLabel="Création…"
            resetOnSuccess
          />
        </section>
      </div>
    </div>
  );
}
