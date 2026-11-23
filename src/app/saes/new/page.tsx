import type { Metadata } from "next";
import { assertAllowed, requireUser } from "@/lib/session";
import { canCreateSae } from "@/lib/permissions";
import { MMI_SAE_TEMPLATES } from "@/data/referentiel-mmi";
import { PageHeader } from "@/components/ui";
import { findCohortOptions, findEditableCourses } from "../_lib/queries";
import { NewSaeForm } from "./new-sae-form";

export const metadata: Metadata = { title: "Nouvelle SAÉ" };

export default async function NewSaePage() {
  const user = await requireUser();
  assertAllowed(canCreateSae(user));

  const [courses, cohorts] = await Promise.all([findEditableCourses(user), findCohortOptions()]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-10">
      <PageHeader breadcrumbs={[{ label: "SAÉ", href: "/saes" }, { label: "Nouvelle" }]} title="Nouvelle SAÉ" />
      <NewSaeForm courses={courses} cohorts={cohorts} templates={MMI_SAE_TEMPLATES} />
    </div>
  );
}
