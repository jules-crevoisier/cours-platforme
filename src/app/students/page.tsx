import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { assertAllowed, requireUser } from "@/lib/session";
import { isStaff } from "@/lib/permissions";
import { EmptyState, PageHeader } from "@/components/ui";
import type { Prisma } from "@/generated/prisma/client";

export const metadata: Metadata = { title: "Étudiants", robots: { index: false, follow: false } };

const LIMIT = 50;

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function StudentsPage({ searchParams }: PageProps<"/students">) {
  const user = await requireUser();
  assertAllowed(isStaff(user));

  const sp = await searchParams;
  const q = (one(sp.q) ?? "").trim().slice(0, 100);
  const rawPromo = (one(sp.promo) ?? "").trim();
  const promo = /^[A-Za-z0-9_-]{1,64}$/.test(rawPromo) ? rawPromo : "";

  const filters: Prisma.UserWhereInput[] = [{ role: "STUDENT" }];
  if (q) {
    filters.push({
      OR: [
        { name: { contains: q } },
        { email: { contains: q } },
        { cohorts: { some: { cohort: { name: { contains: q } } } } },
      ],
    });
  }
  if (promo) filters.push({ cohorts: { some: { cohortId: promo } } });
  const where: Prisma.UserWhereInput = { AND: filters };

  const [cohorts, total, students] = await Promise.all([
    db.cohort.findMany({
      orderBy: [{ academicYear: "desc" }, { name: "asc" }],
      take: 100,
      select: { id: true, name: true, academicYear: true },
    }),
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: { name: "asc" },
      take: LIMIT,
      select: {
        id: true,
        name: true,
        cohorts: { take: 5, select: { cohort: { select: { id: true, name: true } } } },
      },
    }),
  ]);
  const filtered = !!(q || promo);

  return (
    <div className="flex flex-col gap-10">
      <PageHeader title="Étudiants" />

      <form
        method="get"
        action="/students"
        role="search"
        aria-label="Rechercher un étudiant"
        className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <div className="sm:min-w-64 sm:flex-1">
          <label htmlFor="students-q" className="label">
            Nom, e-mail ou promo
          </label>
          <input
            id="students-q"
            name="q"
            type="search"
            defaultValue={q}
            maxLength={100}
            autoComplete="off"
            className="input"
          />
        </div>
        <div className="sm:w-64">
          <label htmlFor="students-promo" className="label">
            Promo
          </label>
          <select id="students-promo" name="promo" defaultValue={promo} className="input">
            <option value="">Toutes les promos</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.academicYear})
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn btn-primary">
            Filtrer
          </button>
          {filtered && (
            <Link href="/students" className="btn btn-ghost">
              Effacer
            </Link>
          )}
        </div>
      </form>

      <section aria-labelledby="students-results" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="students-results" className={total === 0 ? "sr-only" : "text-xl"}>
            {total === 0 ? "Résultats" : `${total} étudiant${total > 1 ? "s" : ""}`}
          </h2>
          {total > LIMIT && <p className="text-sm text-muted">{LIMIT} premiers affichés.</p>}
        </div>

        {students.length === 0 ? (
          <EmptyState>{filtered ? "Aucun résultat." : "Aucun étudiant."}</EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-line border-y border-line">
            {students.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/students/${s.id}`}
                  className="flex min-h-11 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-2 py-3 transition-colors hover:bg-sunken"
                >
                  <span className="min-w-0 font-medium break-words">{s.name}</span>
                  {s.cohorts.length > 0 && (
                    <span className="text-sm text-muted">{s.cohorts.map((c) => c.cohort.name).join(", ")}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
