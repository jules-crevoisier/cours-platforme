"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { canEditCourse } from "@/lib/permissions";

const idsSchema = z.array(z.string().min(1).max(64)).min(1).max(500);

/**
 * Publie la sélection de cours. Seuls ceux que l'utilisateur peut modifier sont publiés
 * (les autres identifiants sont ignorés, sans erreur). Redirige vers la liste avec le nombre publié.
 */
export async function publishCourses(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = idsSchema.safeParse(formData.getAll("ids").filter((v): v is string => typeof v === "string"));
  if (!parsed.success) redirect("/courses?publie=0");

  const courses = await db.course.findMany({
    where: { id: { in: parsed.data }, published: false },
    select: { id: true, ownerId: true, published: true, editors: { select: { id: true } } },
  });
  const allowed = courses.filter((c) => canEditCourse(user, c)).map((c) => c.id);
  if (allowed.length) {
    await db.course.updateMany({ where: { id: { in: allowed } }, data: { published: true } });
    revalidatePath("/courses");
    revalidatePath("/");
  }
  redirect(`/courses?publie=${allowed.length}`);
}
