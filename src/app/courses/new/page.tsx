import type { Metadata } from "next";
import { assertAllowed, requireUser } from "@/lib/session";
import { canCreateCourse } from "@/lib/permissions";
import { PageHeader } from "@/components/ui";
import { NewCourseForm } from "./new-course-form";

export const metadata: Metadata = { title: "Nouveau cours" };

export default async function NewCoursePage() {
  const user = await requireUser();
  assertAllowed(canCreateCourse(user));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-10">
      <PageHeader breadcrumbs={[{ label: "Cours", href: "/courses" }, { label: "Nouveau" }]} title="Nouveau cours" />
      <NewCourseForm />
    </div>
  );
}
