import type { Metadata } from "next";
import { visibleCourseForMetadata } from "@/app/courses/_lib/metadata";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { assertAllowed, requireUser } from "@/lib/session";
import { canModerateQuestion, canSeeAnonymousAuthor, canViewCourse } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import { EmptyState, PageHeader } from "@/components/ui";
import { ActionButton } from "../../_components/action-button";
import { Chevron } from "../../_components/chevron";
import { setQuestionInFaq } from "../pages/[pageId]/actions";

const MAX_FAQ = 100;

export async function generateMetadata({ params }: PageProps<"/courses/[slug]/faq">): Promise<Metadata> {
  const { slug } = await params;
  const course = await visibleCourseForMetadata({ slug });
  return { title: course ? `FAQ — ${course.title}` : "FAQ" };
}

export default async function CourseFaqPage({ params }: PageProps<"/courses/[slug]/faq">) {
  const user = await requireUser();
  const { slug } = await params;

  const course = await db.course.findUnique({ where: { slug }, include: { editors: { select: { id: true } } } });
  if (!course) notFound();
  assertAllowed(canViewCourse(user, course));

  const moderate = canModerateQuestion(user, course);
  const seeAnonymous = canSeeAnonymousAuthor(user, course);
  const team = new Set([course.ownerId, ...course.editors.map((e) => e.id)]);

  const questions = await db.pageQuestion.findMany({
    where: { inFaq: true, page: { courseId: course.id } },
    orderBy: { createdAt: "desc" },
    take: MAX_FAQ,
    select: {
      id: true,
      body: true,
      createdAt: true,
      authorId: true,
      anonymous: true,
      page: { select: { id: true, title: true } },
      answers: {
        orderBy: { createdAt: "asc" },
        take: 20,
        select: { id: true, body: true, authorId: true, author: { select: { name: true } } },
      },
    },
  });

  /** Même libellé d'auteur que sous les pages (questions-section) */
  function answerAuthor(q: (typeof questions)[number], a: (typeof questions)[number]["answers"][number]) {
    if (q.anonymous && a.authorId === q.authorId && !seeAnonymous && a.authorId !== user.id) return "Auteur de la question";
    return team.has(a.authorId) ? `${a.author.name} (équipe du cours)` : a.author.name;
  }

  return (
    <div className="flex max-w-[70ch] flex-col gap-10">
      <PageHeader
        breadcrumbs={[
          { label: "Cours", href: "/courses" },
          { label: course.title, href: `/courses/${course.slug}` },
          { label: "FAQ" },
        ]}
        title="Questions fréquentes"
      />

      {questions.length === 0 ? (
        <EmptyState>Aucune question.</EmptyState>
      ) : (
        <ul className="flex flex-col divide-y divide-line border-y border-line">
          {questions.map((q) => (
            <li key={q.id}>
              <details className="group">
                <summary className="flex min-h-11 cursor-pointer items-center gap-3 py-3 font-semibold list-none [&::-webkit-details-marker]:hidden">
                  <Chevron />
                  <span className="min-w-0 whitespace-pre-line break-words">{q.body}</span>
                </summary>
                <div className="flex flex-col gap-4 pb-5 pl-7">
                  {q.answers.length === 0 ? (
                    <p className="text-muted">Pas encore de réponse.</p>
                  ) : (
                    <ol aria-label="Réponses" className="flex flex-col gap-4 border-l-2 border-line pl-4">
                      {q.answers.map((a) => (
                        <li key={a.id} className="flex flex-col gap-1">
                          <span className="text-sm font-medium">{answerAuthor(q, a)}</span>
                          <p className="whitespace-pre-line break-words">{a.body}</p>
                        </li>
                      ))}
                    </ol>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
                    <span>
                      Posée le {formatDate(q.createdAt)} sur{" "}
                      <Link
                        href={`/courses/${course.slug}/pages/${q.page.id}#q-${q.id}`}
                        className="inline-flex min-h-11 items-center underline"
                      >
                        {q.page.title}
                      </Link>
                    </span>
                    {moderate && (
                      <ActionButton
                        action={setQuestionInFaq.bind(null, q.id, false)}
                        label="Retirer de la FAQ"
                        pendingLabel="Retrait…"
                        variant="ghost"
                      />
                    )}
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
