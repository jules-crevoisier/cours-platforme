"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { canAnnounce, canCreateCourse, canDeleteCourse, canEditCourse, isStaff } from "@/lib/permissions";
import { editorContentSchema, slugify } from "@/lib/content";
import { snapshotPageBeforeWrite } from "@/lib/revisions";
import { randomToken } from "@/lib/tokens";
import type { ActionState } from "./_lib/action-state";
import { pagesByDepth } from "./_lib/tree";
import type { SaveResult } from "@/components/editor";

// ── Schémas ──────────────────────────────────────────────────
const idSchema = z.string().min(1).max(64);

import { parseSemester } from "@/lib/semesters";

// Les colonnes String de Prisma sont des VARCHAR(191) sous MariaDB
const TITLE_MAX = 190;

const courseFieldsSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Le titre est obligatoire.")
    .max(TITLE_MAX, `Titre trop long (${TITLE_MAX} caractères max).`),
  summary: z
    .string()
    .trim()
    .max(5000, "Résumé trop long (5000 caractères max).")
    .transform((s) => (s.length > 0 ? s : null)),
  semester: z.string().transform((s) => parseSemester(s)),
});

const pageTitleSchema = z
  .string()
  .trim()
  .min(1, "Le titre est obligatoire.")
  .max(TITLE_MAX, `Titre trop long (${TITLE_MAX} caractères max).`);

const announcementSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Le titre de l'annonce est obligatoire.")
    .max(TITLE_MAX, `Titre trop long (${TITLE_MAX} caractères max).`),
  body: z.string().trim().min(1, "Le texte de l'annonce est obligatoire.").max(5000, "Annonce trop longue (5000 caractères max)."),
  pinned: z.boolean(),
});

const emailSchema = z.email("Adresse e-mail invalide.").max(320);

const directionSchema = z.enum(["up", "down"]);

// ── Utilitaires ──────────────────────────────────────────────
function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

function firstError(error: z.ZodError) {
  return error.issues[0]?.message ?? "Données invalides.";
}

async function loadCourse(courseId: string) {
  return db.course.findUnique({
    where: { id: courseId },
    include: { editors: { select: { id: true } } },
  });
}

async function loadPageWithCourse(pageId: string) {
  return db.page.findUnique({
    where: { id: pageId },
    include: { course: { include: { editors: { select: { id: true } } } } },
  });
}

function revalidateCourse(slug: string) {
  revalidatePath("/courses");
  revalidatePath(`/courses/${slug}`, "layout");
  revalidatePath("/");
}

async function uniqueSlug(title: string) {
  const base = slugify(title) || "cours";
  const taken = new Set(
    (await db.course.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } })).map((c) => c.slug),
  );
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

function isUniqueViolation(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

// ── Cours ────────────────────────────────────────────────────
export async function createCourse(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!canCreateCourse(user)) return { ok: false, error: "Seuls les enseignants peuvent créer un cours." };

  const parsed = courseFieldsSchema.safeParse({ title: str(formData, "title"), summary: str(formData, "summary"), semester: str(formData, "semester") });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  let slug: string | null = null;
  for (let attempt = 0; attempt < 3 && !slug; attempt++) {
    const candidate = await uniqueSlug(parsed.data.title);
    try {
      await db.course.create({
        data: { slug: candidate, title: parsed.data.title, summary: parsed.data.summary, semester: parsed.data.semester, ownerId: user.id },
      });
      slug = candidate;
    } catch (err) {
      if (!isUniqueViolation(err)) return { ok: false, error: "Impossible de créer le cours." };
    }
  }
  if (!slug) return { ok: false, error: "Impossible de générer une adresse unique pour ce cours." };

  revalidatePath("/courses");
  revalidatePath("/");
  redirect(`/courses/${slug}`);
}

export async function updateCourseSettings(courseId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!idSchema.safeParse(courseId).success) return { ok: false, error: "Cours invalide." };

  const parsed = courseFieldsSchema
    .extend({ published: z.boolean() })
    .safeParse({
      title: str(formData, "title"),
      summary: str(formData, "summary"),
      semester: str(formData, "semester"),
      published: formData.get("published") === "on",
    });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const course = await loadCourse(courseId);
  if (!course) return { ok: false, error: "Cours introuvable." };
  if (!canEditCourse(user, course)) return { ok: false, error: "Vous ne pouvez pas modifier ce cours." };

  await db.course.update({
    where: { id: course.id },
    data: { title: parsed.data.title, summary: parsed.data.summary, semester: parsed.data.semester, published: parsed.data.published },
  });
  revalidateCourse(course.slug);
  return { ok: true };
}

export async function addCourseEditor(courseId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!idSchema.safeParse(courseId).success) return { ok: false, error: "Cours invalide." };

  const parsed = emailSchema.safeParse(str(formData, "email").trim().toLowerCase());
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const course = await loadCourse(courseId);
  if (!course) return { ok: false, error: "Cours introuvable." };
  if (!canEditCourse(user, course)) return { ok: false, error: "Vous ne pouvez pas modifier ce cours." };

  const target = await db.user.findUnique({ where: { email: parsed.data }, select: { id: true, role: true } });
  if (!target) return { ok: false, error: "Aucun utilisateur avec cette adresse." };
  if (!isStaff(target)) return { ok: false, error: "Seuls les enseignants et administrateurs peuvent co-éditer un cours." };
  if (target.id === course.ownerId) return { ok: false, error: "Cette personne est déjà propriétaire du cours." };
  if (course.editors.some((e) => e.id === target.id)) return { ok: false, error: "Cette personne est déjà co-éditrice." };

  await db.course.update({ where: { id: course.id }, data: { editors: { connect: { id: target.id } } } });
  revalidateCourse(course.slug);
  return { ok: true };
}

export async function removeCourseEditor(courseId: string, editorId: string): Promise<ActionState> {
  const user = await requireUser();
  if (!idSchema.safeParse(courseId).success || !idSchema.safeParse(editorId).success) {
    return { ok: false, error: "Requête invalide." };
  }

  const course = await loadCourse(courseId);
  if (!course) return { ok: false, error: "Cours introuvable." };
  if (!canEditCourse(user, course)) return { ok: false, error: "Vous ne pouvez pas modifier ce cours." };
  if (!course.editors.some((e) => e.id === editorId)) return { ok: false, error: "Cette personne n'est pas co-éditrice." };

  await db.course.update({ where: { id: course.id }, data: { editors: { disconnect: { id: editorId } } } });
  revalidateCourse(course.slug);
  return { ok: true };
}

export async function deleteCourse(courseId: string): Promise<ActionState> {
  const user = await requireUser();
  if (!idSchema.safeParse(courseId).success) return { ok: false, error: "Cours invalide." };

  const course = await loadCourse(courseId);
  if (!course) return { ok: false, error: "Cours introuvable." };
  if (!canDeleteCourse(user, course)) {
    return { ok: false, error: "Seul le propriétaire ou un administrateur peut supprimer ce cours." };
  }

  await db.course.delete({ where: { id: course.id } });
  revalidatePath("/courses");
  revalidatePath("/");
  redirect("/courses");
}

// ── Pages ────────────────────────────────────────────────────
export async function createPage(
  courseId: string,
  parentId: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  if (!idSchema.safeParse(courseId).success || (parentId !== null && !idSchema.safeParse(parentId).success)) {
    return { ok: false, error: "Requête invalide." };
  }
  const title = pageTitleSchema.safeParse(str(formData, "title"));
  if (!title.success) return { ok: false, error: firstError(title.error) };

  const course = await loadCourse(courseId);
  if (!course) return { ok: false, error: "Cours introuvable." };
  if (!canEditCourse(user, course)) return { ok: false, error: "Vous ne pouvez pas modifier ce cours." };

  if (parentId) {
    const parent = await db.page.findUnique({ where: { id: parentId }, select: { courseId: true } });
    if (!parent || parent.courseId !== course.id) return { ok: false, error: "Page parente introuvable." };
  }

  const max = await db.page.aggregate({
    where: { courseId: course.id, parentId },
    _max: { position: true },
  });
  const page = await db.page.create({
    data: {
      courseId: course.id,
      parentId,
      title: title.data,
      position: (max._max.position ?? -1) + 1,
      updatedById: user.id,
    },
    select: { id: true },
  });

  revalidateCourse(course.slug);
  redirect(`/courses/${course.slug}/pages/${page.id}`);
}

export async function renamePage(pageId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!idSchema.safeParse(pageId).success) return { ok: false, error: "Page invalide." };
  const title = pageTitleSchema.safeParse(str(formData, "title"));
  if (!title.success) return { ok: false, error: firstError(title.error) };

  const page = await loadPageWithCourse(pageId);
  if (!page) return { ok: false, error: "Page introuvable." };
  if (!canEditCourse(user, page.course)) return { ok: false, error: "Vous ne pouvez pas modifier ce cours." };

  await snapshotPageBeforeWrite(page.id, user.id);
  await db.page.update({ where: { id: page.id }, data: { title: title.data, updatedById: user.id } });
  revalidateCourse(page.course.slug);
  return { ok: true };
}

/** Échange la position avec la page sœur précédente/suivante (positions renumérotées 0..n) */
export async function movePage(pageId: string, direction: "up" | "down"): Promise<ActionState> {
  const user = await requireUser();
  const dir = directionSchema.safeParse(direction);
  if (!idSchema.safeParse(pageId).success || !dir.success) return { ok: false, error: "Requête invalide." };

  const page = await loadPageWithCourse(pageId);
  if (!page) return { ok: false, error: "Page introuvable." };
  if (!canEditCourse(user, page.course)) return { ok: false, error: "Vous ne pouvez pas modifier ce cours." };

  const siblings = await db.page.findMany({
    where: { courseId: page.courseId, parentId: page.parentId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  const index = siblings.findIndex((s) => s.id === page.id);
  const target = dir.data === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= siblings.length) return { ok: true };

  const ordered = siblings.map((s) => s.id);
  [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
  await db.$transaction(ordered.map((id, position) => db.page.update({ where: { id }, data: { position } })));

  revalidateCourse(page.course.slug);
  return { ok: true };
}

export async function deletePage(pageId: string): Promise<ActionState> {
  const user = await requireUser();
  if (!idSchema.safeParse(pageId).success) return { ok: false, error: "Page invalide." };

  const page = await loadPageWithCourse(pageId);
  if (!page) return { ok: false, error: "Page introuvable." };
  if (!canEditCourse(user, page.course)) return { ok: false, error: "Vous ne pouvez pas modifier ce cours." };

  // Les sous-pages sont supprimées en cascade (onDelete: Cascade sur parentId)
  await db.page.delete({ where: { id: page.id } });
  revalidateCourse(page.course.slug);
  redirect(
    page.parentId ? `/courses/${page.course.slug}/pages/${page.parentId}` : `/courses/${page.course.slug}`,
  );
}

/** Autosave de l'éditeur : onSave={savePageContent.bind(null, page.id)} */
export async function savePageContent(pageId: string, content: unknown, markdown: string): Promise<SaveResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(pageId).success) return { ok: false, error: "Page invalide." };

  const parsed = editorContentSchema.safeParse({ content, markdown });
  if (!parsed.success) return { ok: false, error: "Contenu invalide ou trop volumineux." };

  const page = await loadPageWithCourse(pageId);
  if (!page) return { ok: false, error: "Page introuvable." };
  if (!canEditCourse(user, page.course)) return { ok: false, error: "Vous ne pouvez pas modifier ce cours." };

  try {
    await snapshotPageBeforeWrite(page.id, user.id);
    await db.page.update({
      where: { id: page.id },
      data: {
        content: parsed.data.content as Prisma.InputJsonValue,
        markdown: parsed.data.markdown,
        updatedById: user.id,
      },
    });
  } catch (e) {
    // Jamais d'exception vers le client : l'éditeur affiche l'erreur sans perdre le contenu
    console.error("savePageContent", e);
    return { ok: false, error: "Enregistrement impossible, réessayez dans un instant." };
  }
  revalidatePath(`/courses/${page.course.slug}/pages/${page.id}`);
  return { ok: true };
}

// ── Duplication ──────────────────────────────────────────────
const MAX_PAGES_TO_COPY = 1000;
const COPY_CHUNK = 25;

/** Copie profonde de l'arbre de pages dans un nouveau cours non publié (sans questions, historique ni lien public) */
export async function duplicateCourse(courseId: string): Promise<ActionState> {
  const user = await requireUser();
  if (!idSchema.safeParse(courseId).success) return { ok: false, error: "Cours invalide." };

  const course = await loadCourse(courseId);
  if (!course) return { ok: false, error: "Cours introuvable." };
  if (!canEditCourse(user, course) || !canCreateCourse(user)) {
    return { ok: false, error: "Vous ne pouvez pas dupliquer ce cours." };
  }

  const pages = await db.page.findMany({
    where: { courseId: course.id },
    select: { id: true, parentId: true, title: true, position: true, content: true, markdown: true },
    take: MAX_PAGES_TO_COPY + 1,
  });
  if (pages.length > MAX_PAGES_TO_COPY) {
    return { ok: false, error: `Cours trop volumineux pour être dupliqué (plus de ${MAX_PAGES_TO_COPY} pages).` };
  }
  const levels = pagesByDepth(pages);
  const title = `${course.title} (copie)`.slice(0, TITLE_MAX);

  let slug: string | null = null;
  for (let attempt = 0; attempt < 3 && !slug; attempt++) {
    const candidate = await uniqueSlug(`${course.title} copie`);
    try {
      await db.$transaction(
        async (tx) => {
          const copy = await tx.course.create({
            data: { slug: candidate, title, summary: course.summary, semester: course.semester, ownerId: user.id, published: false },
            select: { id: true },
          });
          // Parents toujours insérés avant leurs enfants (niveau par niveau)
          const newIds = new Map<string, string>();
          for (const level of levels) {
            for (let i = 0; i < level.length; i += COPY_CHUNK) {
              const data = level.slice(i, i + COPY_CHUNK).map((p) => {
                const id = randomUUID();
                newIds.set(p.id, id);
                return {
                  id,
                  courseId: copy.id,
                  parentId: p.parentId ? (newIds.get(p.parentId) ?? null) : null,
                  title: p.title,
                  position: p.position,
                  content: p.content === null ? undefined : (p.content as Prisma.InputJsonValue),
                  markdown: p.markdown,
                  updatedById: user.id,
                };
              });
              await tx.page.createMany({ data });
            }
          }
        },
        { maxWait: 10_000, timeout: 60_000 },
      );
      slug = candidate;
    } catch (err) {
      if (!isUniqueViolation(err)) return { ok: false, error: "Impossible de dupliquer le cours." };
    }
  }
  if (!slug) return { ok: false, error: "Impossible de générer une adresse unique pour la copie." };

  revalidatePath("/courses");
  revalidatePath("/");
  redirect(`/courses/${slug}`);
}

// ── Lien public en lecture seule ─────────────────────────────
/** Crée (ou régénère, ce qui invalide l'ancien) le lien /p/course/<jeton> */
export async function enableCourseShareLink(courseId: string): Promise<ActionState> {
  const user = await requireUser();
  if (!idSchema.safeParse(courseId).success) return { ok: false, error: "Cours invalide." };

  const course = await loadCourse(courseId);
  if (!course) return { ok: false, error: "Cours introuvable." };
  if (!canEditCourse(user, course)) return { ok: false, error: "Vous ne pouvez pas modifier ce cours." };

  await db.course.update({ where: { id: course.id }, data: { shareToken: randomToken() } });
  if (course.shareToken) revalidatePath(`/p/course/${course.shareToken}`, "layout");
  revalidateCourse(course.slug);
  return { ok: true };
}

export async function revokeCourseShareLink(courseId: string): Promise<ActionState> {
  const user = await requireUser();
  if (!idSchema.safeParse(courseId).success) return { ok: false, error: "Cours invalide." };

  const course = await loadCourse(courseId);
  if (!course) return { ok: false, error: "Cours introuvable." };
  if (!canEditCourse(user, course)) return { ok: false, error: "Vous ne pouvez pas modifier ce cours." };

  await db.course.update({ where: { id: course.id }, data: { shareToken: null } });
  if (course.shareToken) revalidatePath(`/p/course/${course.shareToken}`, "layout");
  revalidateCourse(course.slug);
  return { ok: true };
}

// ── Annonces du cours ────────────────────────────────────────
/** Annonce de portée COURSE (aucune notification : un cours n'a pas de membres inscrits) */
export async function createCourseAnnouncement(courseId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!idSchema.safeParse(courseId).success) return { ok: false, error: "Cours invalide." };

  const values = {
    title: str(formData, "title"),
    body: str(formData, "body"),
    pinned: formData.get("pinned") === "on" ? "on" : "",
  };
  const parsed = announcementSchema.safeParse({ title: values.title, body: values.body, pinned: values.pinned === "on" });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error), values };

  const course = await loadCourse(courseId);
  if (!course) return { ok: false, error: "Cours introuvable." };
  if (!canAnnounce(user, { scope: "COURSE", course })) {
    return { ok: false, error: "Vous ne pouvez pas publier d'annonce dans ce cours.", values };
  }

  await db.announcement.create({
    data: {
      scope: "COURSE",
      courseId: course.id,
      title: parsed.data.title,
      body: parsed.data.body,
      pinned: parsed.data.pinned,
      authorId: user.id,
    },
  });
  revalidateCourse(course.slug);
  return { ok: true };
}

export async function deleteCourseAnnouncement(announcementId: string): Promise<ActionState> {
  const user = await requireUser();
  if (!idSchema.safeParse(announcementId).success) return { ok: false, error: "Annonce invalide." };

  const announcement = await db.announcement.findUnique({
    where: { id: announcementId },
    include: { course: { include: { editors: { select: { id: true } } } } },
  });
  if (!announcement || announcement.scope !== "COURSE" || !announcement.course) {
    return { ok: false, error: "Annonce introuvable." };
  }
  if (!canAnnounce(user, { scope: "COURSE", course: announcement.course })) {
    return { ok: false, error: "Vous ne pouvez pas supprimer cette annonce." };
  }

  await db.announcement.delete({ where: { id: announcement.id } });
  revalidateCourse(announcement.course.slug);
  return { ok: true };
}
