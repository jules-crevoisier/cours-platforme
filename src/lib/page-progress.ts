import "server-only";
import { db } from "@/lib/db";
import { canViewCourse, type Role } from "@/lib/permissions";
import { buildPageTree, readingOrder } from "@/app/courses/_lib/tree";
import { courseProgress, pageToResume, type CourseProgress } from "@/lib/progress";

/** Pages lues par l'utilisateur dans un cours */
export async function readPageIds(userId: string, courseId: string): Promise<Set<string>> {
  const rows = await db.pageRead.findMany({ where: { userId, page: { courseId } }, select: { pageId: true } });
  return new Set(rows.map((r) => r.pageId));
}

export type ResumeTarget = { courseTitle: string; slug: string; pageId: string; pageTitle: string; progress: CourseProgress };

/** « Reprendre » : le cours lu le plus récemment qui n'est pas terminé, et sa prochaine page. */
export async function loadResumeTarget(userId: string): Promise<ResumeTarget | null> {
  const [me, recent] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { id: true, role: true } }),
    db.pageRead.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { pageId: true, page: { select: { courseId: true } } },
    }),
  ]);
  if (!me) return null;
  const actor = { id: me.id, role: me.role as Role };

  const courseIds = [...new Set(recent.map((r) => r.page.courseId))].slice(0, 5);
  for (const courseId of courseIds) {
    const course = await db.course.findUnique({
      where: { id: courseId },
      select: {
        slug: true,
        title: true,
        ownerId: true,
        published: true,
        editors: { select: { id: true } },
        pages: { select: { id: true, title: true, parentId: true, position: true } },
      },
    });
    if (!course || !canViewCourse(actor, course)) continue;
    const order = readingOrder(buildPageTree(course.pages));
    const readIds = await readPageIds(userId, courseId);
    const progress = courseProgress(order.map((p) => p.id), readIds);
    const lastReadId = recent.find((r) => r.page.courseId === courseId)?.pageId;
    const next = pageToResume(order, readIds, lastReadId);
    if (next) return { courseTitle: course.title, slug: course.slug, pageId: next.id, pageTitle: next.title, progress };
  }
  return null;
}
