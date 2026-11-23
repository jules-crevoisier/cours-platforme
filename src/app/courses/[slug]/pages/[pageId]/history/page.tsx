import type { Metadata } from "next";
import { visiblePageForMetadata } from "@/app/courses/_lib/metadata";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { assertAllowed, requireUser } from "@/lib/session";
import { canEditCourse } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import { BlockEditor } from "@/components/editor";
import { getPeertubeHosts } from "@/components/editor/peertube";
import { EmptyState, PageHeader } from "@/components/ui";
import { ActionButton } from "../../../../_components/action-button";
import { restorePageRevision } from "./actions";

const MAX_REVISIONS = 100;

export async function generateMetadata({ params }: PageProps<"/courses/[slug]/pages/[pageId]/history">): Promise<Metadata> {
  const { pageId } = await params;
  const page = await visiblePageForMetadata(pageId);
  return { title: page ? `Historique — ${page.title}` : "Historique" };
}

export default async function PageHistory({ params, searchParams }: PageProps<"/courses/[slug]/pages/[pageId]/history">) {
  const user = await requireUser();
  const { slug, pageId } = await params;
  const { rev } = await searchParams;

  const course = await db.course.findUnique({ where: { slug }, include: { editors: { select: { id: true } } } });
  if (!course) notFound();
  assertAllowed(canEditCourse(user, course));

  const page = await db.page.findUnique({
    where: { id: pageId },
    select: { id: true, title: true, courseId: true },
  });
  if (!page || page.courseId !== course.id) notFound();

  const revisions = await db.pageRevision.findMany({
    where: { pageId: page.id },
    orderBy: { createdAt: "desc" },
    take: MAX_REVISIONS,
    select: { id: true, title: true, createdAt: true, author: { select: { name: true } } },
  });

  const requested = typeof rev === "string" && rev.length <= 64 ? rev : undefined;
  const selectedId = requested ?? revisions[0]?.id;
  const selected = selectedId
    ? await db.pageRevision.findFirst({
        where: { id: selectedId, pageId: page.id },
        select: { id: true, title: true, content: true, markdown: true, createdAt: true, author: { select: { name: true } } },
      })
    : null;
  const pageHref = `/courses/${course.slug}/pages/${page.id}`;
  const historyHref = `${pageHref}/history`;

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        breadcrumbs={[
          { label: "Cours", href: "/courses" },
          { label: course.title, href: `/courses/${course.slug}` },
          { label: page.title, href: pageHref },
          { label: "Historique" },
        ]}
        title="Historique"
      />

      {revisions.length === 0 ? (
        <EmptyState>Aucune version.</EmptyState>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <nav aria-labelledby="versions-title" className="flex min-w-0 flex-col gap-3">
            <h2 id="versions-title" className="text-xl">
              Versions
            </h2>
            <ol className="flex flex-col divide-y divide-line border-y border-line">
              {revisions.map((r) => {
                const current = r.id === selected?.id;
                return (
                  <li key={r.id}>
                    <Link
                      href={`${historyHref}?rev=${r.id}#apercu`}
                      aria-current={current ? "true" : undefined}
                      className={`flex min-h-11 flex-col justify-center px-3 py-2 hover:bg-sunken ${current ? "bg-accent-soft" : ""}`}
                    >
                      <span className={current ? "font-semibold text-accent" : "font-medium"}>
                        <time dateTime={r.createdAt.toISOString()}>{formatDateTime(r.createdAt)}</time>
                      </span>
                      <span className="flex flex-wrap gap-x-3 text-sm text-muted">
                        <span>{r.author?.name ?? "Auteur inconnu"}</span>
                        {r.title !== page.title && <span className="break-words">« {r.title} »</span>}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </nav>

          <section id="apercu" aria-labelledby="apercu-title" className="flex min-w-0 max-w-[70ch] scroll-mt-4 flex-col gap-4">
            {selected ? (
              <>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <h2 id="apercu-title" className="text-xl break-words">
                      Version du {formatDateTime(selected.createdAt)}
                    </h2>
                    <div className="flex flex-wrap gap-x-4 text-sm text-muted">
                      <span>{selected.author?.name ?? "Auteur inconnu"}</span>
                      {selected.title !== page.title && <span className="break-words">Titre : « {selected.title} »</span>}
                    </div>
                  </div>
                  <ActionButton
                    action={restorePageRevision.bind(null, selected.id)}
                    label="Restaurer cette version"
                    pendingLabel="Restauration…"
                    variant="primary"
                    confirmMessage={`Restaurer la version du ${formatDateTime(selected.createdAt)} ? Le contenu actuel sera conservé dans l'historique.`}
                  />
                </div>
                {selected.content == null && !selected.markdown ? (
                  <EmptyState>Version vide.</EmptyState>
                ) : (
                  <BlockEditor
                    key={selected.id}
                    initialContent={selected.content}
                    initialMarkdown={selected.markdown}
                    editable={false}
                    peertubeHosts={getPeertubeHosts()}
                  />
                )}
              </>
            ) : (
              <>
                <h2 id="apercu-title" className="sr-only">
                  Aperçu
                </h2>
                <EmptyState>Cette version n&apos;existe plus.</EmptyState>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
