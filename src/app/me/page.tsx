import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ROLE_LABELS, isStaff } from "@/lib/permissions";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Mon profil" };

export default async function MePage() {
  const user = await requireUser();
  const staff = isStaff(user);

  const cohorts = await db.cohortMember.findMany({
    where: { userId: user.id },
    take: 20,
    select: { cohort: { select: { id: true, name: true, parcours: true, academicYear: true } } },
  });
  const myCohorts = cohorts
    .map((c) => c.cohort)
    .sort((a, b) => b.academicYear.localeCompare(a.academicYear) || a.name.localeCompare(b.name, "fr"));

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title={user.name}
        meta={<span>{ROLE_LABELS[user.role]}</span>}
        actions={
          <Link href="/me/settings" className="btn">
            Paramètres
          </Link>
        }
      />

      <dl className="grid max-w-2xl gap-x-8 gap-y-3 sm:grid-cols-[max-content_minmax(0,1fr)]">
        <dt className="text-muted">E-mail</dt>
        <dd className="break-all">{user.email}</dd>
        {(myCohorts.length > 0 || !staff) && (
          <>
            <dt className="text-muted">Promo{myCohorts.length > 1 ? "s" : ""}</dt>
            <dd>
              {myCohorts.length === 0 ? (
                <span className="text-muted">Aucune</span>
              ) : (
                <ul className="flex flex-col gap-1">
                  {myCohorts.map((c) => (
                    <li key={c.id} className="flex flex-wrap gap-x-4">
                      <span>{c.name}</span>
                      <span className="text-muted">{c.academicYear}</span>
                      {c.parcours && <span className="text-muted">Parcours {c.parcours}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </dd>
          </>
        )}
      </dl>
    </div>
  );
}
