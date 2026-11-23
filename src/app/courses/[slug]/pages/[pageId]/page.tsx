import type { Metadata } from "next";
import { visiblePageForMetadata } from "@/app/courses/_lib/metadata";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { assertAllowed, requireUser } from "@/lib/session";
import { canEditCourse, canViewCourse } from "@/lib/permissions";
import { formatDateTime, timeAgo } from "@/lib/format";
import { isFavorite } from "@/lib/favorites";
import { BlockEditor } from "@/components/editor";
import { getPeertubeHosts } from "@/components/editor/peertube";
import { FavoriteButton } from "@/components/favorite-button";
import { EmptyState, PageHeader } from "@/components/ui";
import { buildPageTree, pageAncestors, readingOrder } from "../../../_lib/tree";
import { PageTree } from "../../../_components/page-tree";
import { TitleForm } from "../../../_components/title-form";
import { ActionButton } from "../../../_components/action-button";
import { Chevron } from "../../../_components/chevron";
import { QuestionsSection } from "../../../_components/questions-section";
import { createPage, deletePage, movePage, renamePage, savePageContent } from "../../../actions";

export async function generateMetadata({ params }: PageProps<"/courses/[slug]/pages/[pageId]">): Promise<Metadata> {
  const { pageId } = await params;
  const page = await visiblePageForMetadata(pageId);
  return { title: page?.title ?? "Page" };
}

/**
 * Page d'un cours : sommaire à gauche, contenu (éditable en place par l'équipe), questions.
 * Barre d'outils de l'équipe dans l'en-tête : Historique + « Plus d'options » (renommer, sous-page, déplacer, supprimer).
 */
export default async function CoursePageView({ params }: PageProps<"/courses/[slug]/pages/[pageId]">) {
  const user = await requireUser();
  const { slug, pageId } = await params;

  const course = await db.course.findUnique({
    where: { slug },
    include: {
      editors: { select: { id: true } },
      pages: { select: { id: true, title: true, parentId: true, position: true } },
    },
  });
  if (!course) notFound();
  assertAllowed(canViewCourse(user, course));

  const page = await db.page.findUnique({
    where: { id: pageId },
    include: { updatedBy: { select: { name: true } } },
  });
  if (!page || page.courseId !== course.id) notFound();

  const canEdit = canEditCourse(user, course);
  const favorite = await isFavorite(user.id, "PAGE", page.id);
  const tree = buildPageTree(course.pages);
  const ancestors = pageAncestors(course.pages, page.id);
  const siblings = course.pages
    .filter((p) => p.parentId === page.parentId)
    .sort((a, b) => a.position - b.position || a.title.localeCompare(b.title, "fr"));
  const index = siblings.findIndex((p) => p.id === page.id);
  const childCount = course.pages.filter((p) => p.parentId === page.id).length;
  const order = readingOrder(tree);
  const position = order.findIndex((p) => p.id === page.id);
  const prev = position > 0 ? order[position - 1] : undefined;
  const next = position >= 0 && position < order.length - 1 ? order[position + 1] : undefined;
  const isEmpty = !page.content && !page.markdown;
  const courseHref = `/courses/${course.slug}`;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        breadcrumbs={[
          { label: "Cours", href: "/courses" },
          { label: course.title, href: courseHref },
          ...ancestors.map((a) => ({ label: a.title, href: `${courseHref}/pages/${a.id}` })),
          { label: page.title },
        ]}
        title={page.title}
        meta={
          <span>
            Modifié{" "}
            <time dateTime={page.updatedAt.toISOString()} title={formatDateTime(page.updatedAt)}>
              {timeAgo(page.updatedAt)}
            </time>
            {page.updatedBy ? ` par ${page.updatedBy.name}` : ""}
          </span>
        }
        actions={
          <>
            <FavoriteButton kind="PAGE" targetId={page.id} initial={favorite} label="cette page" />
            {canEdit && (
              <>
                <Link href={`${courseHref}/pages/${page.id}/history`} className="btn">
                  Historique
                </Link>
                <details className="group relative open:basis-full md:open:basis-auto">
                  <summary className="btn list-none [&::-webkit-details-marker]:hidden">
                    Plus d&apos;options
                    <Chevron />
                  </summary>
                  <div className="mt-2 flex flex-col gap-5 border border-ink bg-surface p-4 md:absolute md:right-0 md:z-20 md:w-[26rem]">
                    <TitleForm
                      action={renamePage.bind(null, page.id)}
                      label="Titre de la page"
                      submitLabel="Renommer"
                      defaultValue={page.title}
                      successMessage="Titre mis à jour."
                    />
                    <TitleForm
                      action={createPage.bind(null, course.id, page.id)}
                      label="Nouvelle sous-page"
                      submitLabel="Créer"
                      placeholder="Titre de la sous-page"
                    />
                    <div className="flex flex-wrap items-start gap-2">
                      {index > 0 && (
                        <ActionButton
                          action={movePage.bind(null, page.id, "up")}
                          label="↑ Monter"
                          ariaLabel="Monter la page d'un cran"
                          pendingLabel="Déplacement…"
                        />
                      )}
                      {index >= 0 && index < siblings.length - 1 && (
                        <ActionButton
                          action={movePage.bind(null, page.id, "down")}
                          label="↓ Descendre"
                          ariaLabel="Descendre la page d'un cran"
                          pendingLabel="Déplacement…"
                        />
                      )}
                      <ActionButton
                        action={deletePage.bind(null, page.id)}
                        label="Supprimer la page"
                        pendingLabel="Suppression…"
                        variant="danger"
                        className="ml-auto"
                        confirmMessage={
                          childCount > 0
                            ? `Supprimer « ${page.title} » et ses ${childCount} sous-page(s) ? Cette action est définitive.`
                            : `Supprimer « ${page.title} » ? Cette action est définitive.`
                        }
                      />
                    </div>
                  </div>
                </details>
              </>
            )}
          </>
        }
      />

      {/* Mobile : sommaire repliable en haut */}
      <details className="group border border-line md:hidden">
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-4 font-semibold list-none [&::-webkit-details-marker]:hidden">
          <Chevron />
          Sommaire
        </summary>
        <nav aria-label="Sommaire du cours" className="border-t border-line p-2">
          <PageTree nodes={tree} slug={course.slug} currentId={page.id} />
        </nav>
      </details>

      <div className="grid gap-8 md:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="hidden min-w-0 md:block">
          <nav aria-labelledby="sommaire-titre" className="md:sticky md:top-4">
            <h2 id="sommaire-titre" className="mb-2 px-2 text-sm font-semibold text-muted">
              Sommaire
            </h2>
            <PageTree nodes={tree} slug={course.slug} currentId={page.id} />
          </nav>
        </aside>

        <div className="flex min-w-0 max-w-[70ch] flex-col gap-10">
          <div className="flex min-w-0 flex-col gap-6">
            {!canEdit && isEmpty ? (
              <EmptyState>Page vide.</EmptyState>
            ) : (
              <BlockEditor
                key={page.id}
                initialContent={page.content}
                initialMarkdown={page.markdown}
                editable={canEdit}
                onSave={canEdit ? savePageContent.bind(null, page.id) : undefined}
                peertubeHosts={getPeertubeHosts()}
              />
            )}

            {(prev || next) && (
              <nav aria-label="Pages voisines" className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                {prev ? (
                  <Link href={`${courseHref}/pages/${prev.id}`} className="btn justify-start">
                    <span aria-hidden="true">←</span>
                    <span className="min-w-0 truncate">
                      <span className="sr-only">Page précédente : </span>
                      {prev.title}
                    </span>
                  </Link>
                ) : (
                  <span />
                )}
                {next && (
                  <Link href={`${courseHref}/pages/${next.id}`} className="btn justify-end">
                    <span className="min-w-0 truncate">
                      <span className="sr-only">Page suivante : </span>
                      {next.title}
                    </span>
                    <span aria-hidden="true">→</span>
                  </Link>
                )}
              </nav>
            )}
          </div>

          <QuestionsSection user={user} course={course} pageId={page.id} />
        </div>
      </div>
    </div>
  );
}
