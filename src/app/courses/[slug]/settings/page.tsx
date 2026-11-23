import type { Metadata } from "next";
import { visibleCourseForMetadata } from "@/app/courses/_lib/metadata";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { assertAllowed, requireUser } from "@/lib/session";
import { canAnnounce, canCreateCourse, canDeleteCourse, canEditCourse } from "@/lib/permissions";
import { formatDateTime, timeAgo } from "@/lib/format";
import { EmptyState, PageHeader, StatusBadge, Tabs } from "@/components/ui";
import { CourseSettingsForm } from "../../_components/course-settings-form";
import { AddEditorForm } from "../../_components/add-editor-form";
import { ActionButton } from "../../_components/action-button";
import { AnnouncementForm } from "../../_components/announcement-form";
import { CopyLinkField } from "../../_components/copy-link-field";
import {
  addCourseEditor,
  createCourseAnnouncement,
  deleteCourse,
  deleteCourseAnnouncement,
  duplicateCourse,
  enableCourseShareLink,
  removeCourseEditor,
  revokeCourseShareLink,
  updateCourseSettings,
} from "../../actions";

const TABS = [
  { id: "general", label: "Général" },
  { id: "co-editeurs", label: "Co-éditeurs" },
  { id: "partage", label: "Partage" },
  { id: "annonces", label: "Annonces" },
  { id: "avance", label: "Avancé" },
] as const;

type TabId = (typeof TABS)[number]["id"];

async function loadCourse(slug: string) {
  return db.course.findUnique({
    where: { slug },
    include: {
      editors: { select: { id: true, name: true, email: true }, orderBy: { name: "asc" } },
    },
  });
}

export async function generateMetadata({ params }: PageProps<"/courses/[slug]/settings">): Promise<Metadata> {
  const { slug } = await params;
  const course = await visibleCourseForMetadata({ slug });
  return { title: course ? `Paramètres — ${course.title}` : "Paramètres du cours" };
}

/** Gestion d'un cours, en onglets (?onglet=) : paramètres, co-éditeurs, lien public, annonces, duplication et suppression */
export default async function CourseSettingsPage({ params, searchParams }: PageProps<"/courses/[slug]/settings">) {
  const user = await requireUser();
  const { slug } = await params;
  const { onglet } = await searchParams;
  const course = await loadCourse(slug);
  if (!course) notFound();
  // Mêmes contrôles que l'ancienne section de gestion de la page du cours
  const canEdit = canEditCourse(user, course);
  assertAllowed(canEdit);

  const canDelete = canDeleteCourse(user, course);
  const canDuplicate = canEdit && canCreateCourse(user);
  const announce = canAnnounce(user, { scope: "COURSE", course });

  const tabs = TABS.filter(
    (t) => (t.id !== "annonces" || announce) && (t.id !== "avance" || canDuplicate || canDelete),
  );
  const tab: TabId = tabs.find((t) => t.id === onglet)?.id ?? "general";
  const base = `/courses/${course.slug}/settings`;
  const tabLabel = tabs.find((t) => t.id === tab)?.label;

  const announcements =
    tab === "annonces"
      ? await db.announcement.findMany({
          where: { scope: "COURSE", courseId: course.id },
          orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
          take: 20,
          select: { id: true, title: true, pinned: true, createdAt: true, author: { select: { name: true } } },
        })
      : [];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        breadcrumbs={[
          { label: "Cours", href: "/courses" },
          { label: course.title, href: `/courses/${course.slug}` },
          { label: "Paramètres" },
        ]}
        title="Paramètres du cours"
      />

      <Tabs
        label="Paramètres du cours"
        items={tabs.map((t) => ({
          href: t.id === "general" ? base : `${base}?onglet=${t.id}`,
          label: t.label,
          active: t.id === tab,
        }))}
      />

      <section aria-labelledby="onglet-titre" className="flex max-w-2xl flex-col gap-8">
        <h2 id="onglet-titre" className="sr-only">
          {tabLabel}
        </h2>

        {tab === "general" && (
          <CourseSettingsForm
            action={updateCourseSettings.bind(null, course.id)}
            course={{ title: course.title, summary: course.summary, published: course.published }}
          />
        )}

        {tab === "co-editeurs" && (
          <>
            {course.editors.length === 0 ? (
              <EmptyState>Aucun co-éditeur.</EmptyState>
            ) : (
              <ul className="flex flex-col divide-y divide-line border-y border-line">
                {course.editors.map((editor) => (
                  <li key={editor.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
                    <div className="flex min-w-0 flex-wrap gap-x-4">
                      <span className="break-words">{editor.name}</span>
                      <span className="text-sm text-muted break-all">{editor.email}</span>
                    </div>
                    <ActionButton
                      action={removeCourseEditor.bind(null, course.id, editor.id)}
                      label="Retirer"
                      pendingLabel="Retrait…"
                      ariaLabel={`Retirer ${editor.name} des co-éditeurs`}
                      confirmMessage={`Retirer ${editor.name} des co-éditeurs ?`}
                    />
                  </li>
                ))}
              </ul>
            )}
            <AddEditorForm action={addCourseEditor.bind(null, course.id)} />
          </>
        )}

        {tab === "partage" &&
          (course.shareToken ? (
            <>
              <CopyLinkField path={`/p/course/${course.shareToken}`} label="Lien public (lecture seule, sans compte)" />
              <div className="flex flex-wrap gap-2">
                <ActionButton
                  action={enableCourseShareLink.bind(null, course.id)}
                  label="Régénérer le lien"
                  pendingLabel="Régénération…"
                  confirmMessage="Régénérer le lien ? L'ancien lien cessera de fonctionner."
                />
                <ActionButton
                  action={revokeCourseShareLink.bind(null, course.id)}
                  label="Désactiver le lien"
                  pendingLabel="Désactivation…"
                  variant="danger"
                  confirmMessage="Désactiver le lien public ? Les personnes qui l'ont reçu ne pourront plus lire le cours."
                />
              </div>
            </>
          ) : (
            <EmptyState
              action={
                <ActionButton
                  action={enableCourseShareLink.bind(null, course.id)}
                  label="Créer un lien public"
                  pendingLabel="Création…"
                />
              }
            >
              Aucun lien public.
            </EmptyState>
          ))}

        {tab === "annonces" && (
          <>
            <AnnouncementForm action={createCourseAnnouncement.bind(null, course.id)} />
            {announcements.length === 0 ? (
              <EmptyState>Aucune annonce.</EmptyState>
            ) : (
              <ul aria-label="Annonces publiées" className="flex flex-col divide-y divide-line border-y border-line">
                {announcements.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-semibold break-words">{a.title}</span>
                        {a.pinned && <StatusBadge>Épinglée</StatusBadge>}
                      </div>
                      <div className="flex flex-wrap gap-x-4 text-sm text-muted">
                        <span>{a.author.name}</span>
                        <time dateTime={a.createdAt.toISOString()} title={formatDateTime(a.createdAt)}>
                          {timeAgo(a.createdAt)}
                        </time>
                      </div>
                    </div>
                    <ActionButton
                      action={deleteCourseAnnouncement.bind(null, a.id)}
                      label="Supprimer"
                      ariaLabel={`Supprimer l'annonce « ${a.title} »`}
                      pendingLabel="Suppression…"
                      confirmMessage={`Supprimer l'annonce « ${a.title} » ?`}
                    />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {tab === "avance" && (
          <div className="flex flex-wrap gap-2">
            {canDuplicate && (
              <ActionButton
                action={duplicateCourse.bind(null, course.id)}
                label="Dupliquer le cours"
                pendingLabel="Duplication…"
                confirmMessage={`Créer une copie non publiée de « ${course.title} » (pages et contenu) ?`}
              />
            )}
            {canDelete && (
              <ActionButton
                action={deleteCourse.bind(null, course.id)}
                label="Supprimer le cours"
                pendingLabel="Suppression…"
                variant="danger"
                confirmMessage={`Supprimer définitivement le cours « ${course.title} » et toutes ses pages ? Les SAÉ liées sont conservées.`}
              />
            )}
          </div>
        )}
      </section>
    </div>
  );
}
