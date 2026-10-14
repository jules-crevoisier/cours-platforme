import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { canCreateCourse, canEditCourse, isAdmin, isStaff } from "@/lib/permissions";
import { publishCourses } from "./bulk-actions";
import { parsePage } from "./_lib/pagination";

export const metadata: Metadata = { title: "Cours" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function CoursesPage({ searchParams }: PageProps<"/courses">) {
  const user = await requireUser();
  const sp = await searchParams;
  const onlyDrafts = one(sp.etat) === "brouillons" && isStaff(user);
  const q = one(sp.q).trim().slice(0, 100);
  const justPublished = Number.parseInt(one(sp.publie), 10);

  // Même règle que canViewCourse : publiés, ou ceux que je peux modifier.
  const visibility: Prisma.CourseWhereInput = isAdmin(user)
    ? {}
    : { OR: [{ published: true }, { ownerId: user.id }, { editors: { some: { id: user.id } } }] };
  const where: Prisma.CourseWhereInput = {
    AND: [
      visibility,
      onlyDrafts ? { published: false } : {},
      q ? { OR: [{ title: { contains: q } }, { summary: { contains: q } }] } : {},
    ],
  };

  const total = await db.course.count({ where });
  const { page, lastPage, skip, take } = parsePage(sp.page, total);
  const courses = await db.course.findMany({
    where,
    include: {
      editors: { select: { id: true } },
      owner: { select: { name: true } },
      _count: { select: { pages: true } },
    },
    orderBy: [{ title: "asc" }],
    skip,
    take,
  });
  const draftsTotal = isStaff(user)
    ? await db.course.count({ where: { AND: [visibility, { published: false }] } })
    : 0;

  const href = (p: number) => {
    const params = new URLSearchParams();
    if (onlyDrafts) params.set("etat", "brouillons");
    if (q) params.set("q", q);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `/courses?${s}` : "/courses";
  };
  const selectable = courses.filter((c) => !c.published && canEditCourse(user, c));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Cours</h1>
        {canCreateCourse(user) && (
          <Link href="/courses/new" className="btn btn-primary">
            Nouveau cours
          </Link>
        )}
      </div>

      {Number.isFinite(justPublished) && (
        <p role="status" className="card">
          {justPublished > 0
            ? `${justPublished} cours publié${justPublished > 1 ? "s" : ""}.`
            : "Aucun cours publié : sélectionnez au moins un brouillon que vous pouvez modifier."}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <form action="/courses" method="get" role="search" className="flex flex-wrap items-end gap-2">
          {onlyDrafts && <input type="hidden" name="etat" value="brouillons" />}
          <label className="grid gap-1 text-sm">
            <span className="label">Rechercher un cours</span>
            <input type="search" name="q" defaultValue={q} maxLength={100} className="input min-h-11" />
          </label>
          <button type="submit" className="btn min-h-11">
            Rechercher
          </button>
        </form>
        {isStaff(user) && (
          <nav aria-label="Filtrer les cours" className="flex flex-wrap gap-2">
            <Link
              href={q ? `/courses?q=${encodeURIComponent(q)}` : "/courses"}
              className={`btn ${onlyDrafts ? "btn-ghost" : "btn-primary"}`}
              aria-current={onlyDrafts ? undefined : "page"}
            >
              Tous
            </Link>
            <Link
              href={`/courses?etat=brouillons${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={`btn ${onlyDrafts ? "btn-primary" : "btn-ghost"}`}
              aria-current={onlyDrafts ? "page" : undefined}
            >
              Brouillons ({draftsTotal})
            </Link>
          </nav>
        )}
      </div>

      {courses.length === 0 ? (
        <div className="card text-muted">
          <p>{q || onlyDrafts ? "Aucun cours ne correspond." : "Aucun cours disponible pour l'instant."}</p>
          {canCreateCourse(user) && !q && !onlyDrafts && (
            <p className="mt-2">
              <Link href="/courses/new" className="underline">
                Créer votre premier cours
              </Link>
            </p>
          )}
        </div>
      ) : (
        <form action={publishCourses} className="flex flex-col gap-4">
          {selectable.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" className="btn btn-primary min-h-11">
                Publier la sélection
              </button>
              <p className="text-sm text-muted">
                Cochez les brouillons à publier ({selectable.length} sur cette page). Les cours publiés sont visibles de
                tous les étudiants.
              </p>
            </div>
          )}
          <ul className="grid gap-3 md:grid-cols-2">
            {courses.map((course) => (
              <li key={course.id} className="card flex min-w-0 flex-col gap-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="min-w-0 text-lg font-semibold break-words">
                    <Link href={`/courses/${course.slug}`} className="hover:underline">
                      {course.title}
                    </Link>
                  </h2>
                  {!course.published && <span className="badge">Brouillon</span>}
                </div>
                {course.summary && <p className="line-clamp-3 text-muted break-words">{course.summary}</p>}
                <p className="mt-auto text-sm text-muted">
                  {course._count.pages} page{course._count.pages > 1 ? "s" : ""} · {course.owner.name}
                  {canEditCourse(user, course) ? " · vous pouvez modifier" : ""}
                </p>
                {!course.published && canEditCourse(user, course) && (
                  <label className="flex min-h-11 items-center gap-2 text-sm">
                    <input type="checkbox" name="ids" value={course.id} className="size-5" />
                    <span>Publier ce cours</span>
                  </label>
                )}
              </li>
            ))}
          </ul>
        </form>
      )}

      {lastPage > 1 && (
        <nav aria-label="Pagination" className="flex flex-wrap items-center gap-3">
          {page > 1 ? (
            <Link href={href(page - 1)} className="btn btn-ghost">
              ← Précédente
            </Link>
          ) : (
            <span />
          )}
          <span className="font-mono text-sm text-muted">
            Page {page} / {lastPage} · {total} cours
          </span>
          {page < lastPage && (
            <Link href={href(page + 1)} className="btn btn-ghost">
              Suivante →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
