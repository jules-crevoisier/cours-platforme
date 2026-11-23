import { db } from "@/lib/db";
import { formatDateTime, timeAgo } from "@/lib/format";
import {
  canAnswerQuestion,
  canAskQuestion,
  canModerateQuestion,
  canResolveQuestion,
  canSeeAnonymousAuthor,
  type Actor,
} from "@/lib/permissions";
import { EmptyState, StatusBadge } from "@/components/ui";
import { ActionButton } from "./action-button";
import { Chevron } from "./chevron";
import { AnswerForm } from "./answer-form";
import { QuestionForm } from "./question-form";
import {
  answerQuestion,
  askQuestion,
  deleteAnswer,
  deleteQuestion,
  setQuestionInFaq,
  setQuestionResolved,
} from "../[slug]/pages/[pageId]/actions";

const MAX_QUESTIONS = 50;
const MAX_ANSWERS = 50;

type CourseForQuestions = { ownerId: string; published: boolean; editors: { id: string }[] };

type Props = { user: Actor; course: CourseForQuestions; pageId: string };

/**
 * Questions & réponses sous une page de cours (les 50 plus récentes). Texte brut uniquement.
 * Un badge par question (Résolue, sinon FAQ) ; « Répondre » visible, les autres actions dans un menu.
 * L'identité d'un auteur anonyme n'est jamais envoyée au navigateur d'un étudiant.
 */
export async function QuestionsSection({ user, course, pageId }: Props) {
  const questions = await db.pageQuestion.findMany({
    where: { pageId },
    orderBy: { createdAt: "desc" },
    take: MAX_QUESTIONS,
    select: {
      id: true,
      body: true,
      anonymous: true,
      resolved: true,
      inFaq: true,
      createdAt: true,
      authorId: true,
      author: { select: { name: true } },
      answers: {
        orderBy: { createdAt: "asc" },
        take: MAX_ANSWERS,
        select: { id: true, body: true, createdAt: true, authorId: true, author: { select: { name: true } } },
      },
    },
  });

  const team = new Set([course.ownerId, ...course.editors.map((e) => e.id)]);
  const seeAnonymous = canSeeAnonymousAuthor(user, course);
  const moderate = canModerateQuestion(user, course);
  const canAsk = canAskQuestion(user, course);
  const canAnswer = canAnswerQuestion(user, course);

  function questionAuthor(q: (typeof questions)[number]) {
    if (q.authorId === user.id) return q.anonymous ? "Vous (anonyme)" : "Vous";
    if (!q.anonymous) return q.author.name;
    return seeAnonymous ? `${q.author.name} (anonyme)` : "Anonyme";
  }

  function answerAuthor(q: (typeof questions)[number], a: (typeof questions)[number]["answers"][number]) {
    if (a.authorId === user.id) return "Vous";
    // Une relance de l'auteur d'une question anonyme ne doit pas révéler son nom
    if (q.anonymous && a.authorId === q.authorId && !seeAnonymous) return "Auteur de la question";
    return team.has(a.authorId) ? `${a.author.name} (équipe du cours)` : a.author.name;
  }

  return (
    <section aria-labelledby="questions-title" className="flex flex-col gap-6">
      <h2 id="questions-title" className="text-xl">
        Questions
      </h2>

      {canAsk && <QuestionForm action={askQuestion.bind(null, pageId)} />}

      {questions.length === 0 ? (
        <EmptyState>Aucune question.</EmptyState>
      ) : (
        <ol className="flex flex-col divide-y divide-line border-y border-line">
          {questions.map((q) => {
            const canResolve = canResolveQuestion(user, q, course);
            const canDelete = q.authorId === user.id || moderate;
            const hasMenu = canResolve || moderate || canDelete;
            return (
              <li key={q.id} id={`q-${q.id}`} className="flex scroll-mt-20 flex-col gap-3 py-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                    <span className="font-medium text-ink">{questionAuthor(q)}</span>
                    <time dateTime={q.createdAt.toISOString()} title={formatDateTime(q.createdAt)}>
                      {timeAgo(q.createdAt)}
                    </time>
                    {q.resolved ? (
                      <StatusBadge tone="ok">Résolue</StatusBadge>
                    ) : (
                      q.inFaq && <StatusBadge>FAQ</StatusBadge>
                    )}
                  </div>
                  {hasMenu && (
                    <details className="group relative ml-auto">
                      <summary className="btn btn-ghost list-none [&::-webkit-details-marker]:hidden">
                        Options<span className="sr-only"> de la question</span>
                        <Chevron />
                      </summary>
                      <div className="absolute right-0 z-20 mt-1 flex w-60 flex-col border border-ink bg-surface p-1">
                        {canResolve && (
                          <ActionButton
                            action={setQuestionResolved.bind(null, q.id, !q.resolved)}
                            label={q.resolved ? "Rouvrir" : "Marquer comme résolue"}
                            pendingLabel="Enregistrement…"
                            variant="ghost"
                            buttonClassName="w-full justify-start"
                          />
                        )}
                        {moderate && (
                          <ActionButton
                            action={setQuestionInFaq.bind(null, q.id, !q.inFaq)}
                            label={q.inFaq ? "Retirer de la FAQ" : "Ajouter à la FAQ"}
                            pendingLabel="Enregistrement…"
                            variant="ghost"
                            buttonClassName="w-full justify-start"
                          />
                        )}
                        {canDelete && (
                          <ActionButton
                            action={deleteQuestion.bind(null, q.id)}
                            label="Supprimer"
                            ariaLabel="Supprimer la question et ses réponses"
                            pendingLabel="Suppression…"
                            variant="ghost"
                            buttonClassName="w-full justify-start text-danger"
                            confirmMessage="Supprimer cette question et toutes ses réponses ?"
                          />
                        )}
                      </div>
                    </details>
                  )}
                </div>
                <p className="whitespace-pre-line break-words">{q.body}</p>

                {q.answers.length > 0 && (
                  <ol aria-label="Réponses" className="flex flex-col gap-4 border-l-2 border-line pl-4">
                    {q.answers.map((a) => (
                      <li key={a.id} className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                          <span className="font-medium text-ink">{answerAuthor(q, a)}</span>
                          <time dateTime={a.createdAt.toISOString()} title={formatDateTime(a.createdAt)}>
                            {timeAgo(a.createdAt)}
                          </time>
                          {(a.authorId === user.id || moderate) && (
                            <ActionButton
                              action={deleteAnswer.bind(null, a.id)}
                              label="Supprimer"
                              ariaLabel="Supprimer la réponse"
                              pendingLabel="Suppression…"
                              variant="ghost"
                              confirmMessage="Supprimer cette réponse ?"
                            />
                          )}
                        </div>
                        <p className="whitespace-pre-line break-words">{a.body}</p>
                      </li>
                    ))}
                  </ol>
                )}

                {canAnswer && (
                  <details className="group">
                    <summary className="flex min-h-11 w-fit cursor-pointer items-center gap-2 font-medium text-accent list-none [&::-webkit-details-marker]:hidden">
                      <Chevron />
                      Répondre
                    </summary>
                    <AnswerForm action={answerQuestion.bind(null, q.id)} />
                  </details>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
