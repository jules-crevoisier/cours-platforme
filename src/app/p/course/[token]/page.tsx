import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { buildPageTree } from "@/app/courses/_lib/tree";
import { PageTree } from "@/app/courses/_components/page-tree";
import { EmptyState, PageHeader } from "@/components/ui";
import { loadSharedCourse } from "../_lib/load";

export async function generateMetadata({ params }: PageProps<"/p/course/[token]">): Promise<Metadata> {
  const { token } = await params;
  const course = await loadSharedCourse(token);
  return { title: course?.title ?? "Cours partagé", robots: { index: false, follow: false } };
}

/** Lecture publique d'un cours (lien partagé par l'équipe pédagogique, sans compte) : titre, description, sommaire */
export default async function SharedCoursePage({ params }: PageProps<"/p/course/[token]">) {
  // Rendu à chaque requête : un lien révoqué doit cesser de fonctionner immédiatement
  await connection();
  const { token } = await params;
  const course = await loadSharedCourse(token);
  if (!course) notFound();

  const tree = buildPageTree(course.pages);
  const base = `/p/course/${token}`;

  return (
    <div className="flex max-w-[70ch] flex-col gap-10">
      <PageHeader title={course.title} meta={<span>Responsable : {course.owner.name}</span>} />

      {course.summary && <p className="whitespace-pre-line break-words">{course.summary}</p>}

      <section aria-labelledby="sommaire" className="flex flex-col gap-4">
        <h2 id="sommaire" className="text-xl">
          Sommaire
        </h2>
        {tree.length === 0 ? (
          <EmptyState>Aucune page.</EmptyState>
        ) : (
          <nav aria-label="Sommaire du cours" className="-mx-2">
            <PageTree nodes={tree} slug="" basePath={base} />
          </nav>
        )}
      </section>
    </div>
  );
}
