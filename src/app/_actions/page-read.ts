"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { canViewCourse } from "@/lib/permissions";

const idSchema = z.string().min(1).max(64);

/** Marque une page comme lue ou non lue ; renvoie le nouvel état. Vérifie que la page est visible. */
export async function togglePageRead(pageId: string): Promise<{ ok: true; read: boolean } | { ok: false; error: string }> {
  const user = await requireUser();
  const parsed = idSchema.safeParse(pageId);
  if (!parsed.success) return { ok: false, error: "Données invalides." };

  const page = await db.page.findUnique({
    where: { id: parsed.data },
    select: { id: true, course: { select: { slug: true, ownerId: true, published: true, editors: { select: { id: true } } } } },
  });
  if (!page || !canViewCourse(user, page.course)) return { ok: false, error: "Page introuvable." };

  const key = { userId_pageId: { userId: user.id, pageId: page.id } };
  const existing = await db.pageRead.findUnique({ where: key });
  if (existing) await db.pageRead.delete({ where: key });
  else await db.pageRead.upsert({ where: key, create: { userId: user.id, pageId: page.id }, update: {} });

  revalidatePath("/");
  revalidatePath(`/courses/${page.course.slug}`, "layout");
  return { ok: true, read: !existing };
}
