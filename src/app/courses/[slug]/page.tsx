import type { Metadata } from "next";
import { visibleCourseForMetadata } from "@/app/courses/_lib/metadata";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { assertAllowed, requireUser } from "@/lib/session";
import { canEditCourse, canViewCourse, canViewSae } from "@/lib/permissions";
import { formatDateTime, timeAgo } from "@/lib/format";
import { isFavorite } from "@/lib/favorites";
import { FavoriteButton } from "@/components/favorite-button";
import { EmptyState, PageHeader, StatusBadge, Swatch } from "@/components/ui";
import { buildPageTree } from "../_lib/tree";
import { PageTree } from "../_components/page-tree";
import { TitleForm } from "../_components/title-form";
import { createPage } from "../actions";

async function loadCourse(slug: string) {
  return db.course.findUnique({
    where: { slug },
    include: {
      owner: { select: { id: true, name: true } },
      editors: { select: { id: true } },
      pages: { select: { id: true, title: true, parentId: true, position: true } },
    },
  });
}

export async function generateMetadata({ params }: PageProps<"/courses/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const course = await visibleCourseForMetadata({ slug });
  return { title: course?.title ?? "Cours" };
}

/** Lecture d'un cours : description, annonces, sommaire, SAÉ liées. La gestion est dans /settings. */
export default async function CoursePage({ params }: PageProps<"/courses/[slug]">) {
  const user = await requireUser();
  const { slug } = await params;
  const course = await loadCourse(slug);
  if (!course) notFound();
  assertAllowed(canViewCourse(user, course));

  const canEdit = canEditCourse(user, course);
  const tree = buildPageTree(course.pages);

  const [saes, favorite, announcements] = await Promise.all([
    db.sae
      .findMany({
        where: { courseId: course.id },
        include: { teachers: { select: { id: true } } },
        orderBy: [{ semester: "asc" }, { title: "asc" }],
      })
      .then((list) => list.filter((s) => canViewSae(user, s))),
    isFavorite(user.id, "COURSE", course.id),
    db.announcement.findMany({
      where: { scope: "COURSE", courseId: course.id },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 5,
      select: { id: true, title: true, body: true, pinned: true, createdAt: true, author: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        breadcrumbs={[{ label: "Cours", href: "/courses" }, { label: course.title }]}
        title={course.title}
        meta={
          <>
            <span>Responsable : {course.owner.name}</span>
            {!course.published && <StatusBadge tone="warn">Brouillon</StatusBadge>}
          </>
        }
        actions={
          <>
            <FavoriteButton kind="COURSE" targetId={course.id} initial={favorite} label="ce cours" />
            <Link href={`/courses/${course.slug}/faq`} className="btn">
              FAQ
            </Link>
            {canEdit && (
              <Link href={`/courses/${course.slug}/settings`} className="btn">
                Gérer
              </Link>
            )}
          </>
        }
      />

      {course.summary && <p className="max-w-prose whitespace-pre-line break-words">{course.summary}</p>}

      {announcements.length > 0 && (
        <section aria-labelledby="annonces" className="flex flex-col gap-4">
          <h2 id="annonces" className="text-xl">
            Annonces
          </h2>
          <ul className="flex max-w-prose flex-col divide-y divide-line border-y border-line">
            {announcements.map((a) => (
              <li key={a.id} className="flex flex-col gap-2 py-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h3 className="min-w-0 text-base break-words">{a.title}</h3>
                  {a.pinned && <StatusBadge>Épinglée</StatusBadge>}
                </div>
                <p className="whitespace-pre-line break-words">{a.body}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                  <span>{a.author.name}</span>
                  <time dateTime={a.createdAt.toISOString()} title={formatDateTime(a.createdAt)}>
                    {timeAgo(a.createdAt)}
                  </time>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="sommaire" className="flex flex-col gap-4">
        <h2 id="sommaire" className="text-xl">
          Sommaire
        </h2>
        {tree.length === 0 ? (
          <EmptyState>Aucune page.</EmptyState>
        ) : (
          <nav aria-label="Sommaire du cours" className="-mx-2 max-w-prose">
            <PageTree nodes={tree} slug={course.slug} />
          </nav>
        )}
        {canEdit && (
          <div className="max-w-prose">
            <TitleForm
              action={createPage.bind(null, course.id, null)}
              label="Nouvelle page"
              submitLabel="Créer la page"
              placeholder="Titre de la page"
            />
          </div>
        )}
      </section>

      {saes.length > 0 && (
        <section aria-labelledby="saes-liees" className="flex flex-col gap-4">
          <h2 id="saes-liees" className="text-xl">
            SAÉ liées
          </h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {saes.map((sae) => (
              <li key={sae.id}>
                <Link
                  href={`/saes/${sae.id}`}
                  className="card flex h-full min-h-11 items-start gap-4 transition-colors hover:border-ink"
                >
                  <Swatch seed={sae.id} text={sae.code ?? sae.title} />
                  <div className="flex min-w-0 flex-col gap-1">
                    {sae.code && <span className="text-sm text-muted">{sae.code}</span>}
                    <h3 className="text-lg break-words">{sae.title}</h3>
                    {(sae.semester != null || !sae.published) && (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                        {sae.semester != null && <span>Semestre {sae.semester}</span>}
                        {!sae.published && <StatusBadge tone="warn">Brouillon</StatusBadge>}
                      </div>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
