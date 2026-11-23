"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useState, type FormEvent } from "react";
import { LEVELS } from "@/lib/assessment";
import { isSignificantGap } from "@/lib/competences";
import { EmptyState } from "@/components/ui";
import { MAX_BODY, type ActionResult, type CriterionView, type SnippetView } from "./shared";
import { SnippetPicker } from "./snippet-picker";
import { CriterionHeading, GapFlag, LevelMeter } from "./ui";

export type FeedbackFormCriterion = CriterionView & {
  /** Auto-positionnement de l'étudiant·e (null : critère ajouté après la soumission) */
  self: { level: number; justification: string | null } | null;
  teacherLevel: number | null;
  teacherComment: string | null;
};

type Props = {
  /** `saveTeacherFeedback.bind(null, assessmentId)` */
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  criteria: FeedbackFormCriterion[];
  snippets: SnippetView[];
  published: boolean;
  /** Affiche la justification de l'étudiant·e à côté du positionnement (page de l'auto-évaluation) */
  showJustifications?: boolean;
  /** File de correction : après publication, passer à l'auto-évaluation suivante */
  afterPublishHref?: string | null;
};

const NONE = "";

export function TeacherFeedbackForm({
  action,
  criteria,
  snippets,
  published,
  showJustifications = false,
  afterPublishHref = null,
}: Props) {
  const router = useRouter();
  const [levels, setLevels] = useState<Record<string, string>>(() =>
    Object.fromEntries(criteria.map((c) => [c.id, c.teacherLevel == null ? NONE : String(c.teacherLevel)])),
  );
  const [dirty, setDirty] = useState(false);

  const [state, dispatch, pending] = useActionState(async (prev: ActionResult | null, formData: FormData) => {
    const result = await action(prev, formData);
    if (result.ok) {
      setDirty(false);
      if (formData.get("intent") === "publish" && afterPublishHref) router.push(afterPublishHref);
    }
    return result;
  }, null);

  // Avertit avant de quitter la page avec des modifications non enregistrées
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const editable = criteria.filter((c) => c.self !== null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    if (formData.get("intent") === "publish") {
      const missing = editable.filter((c) => (levels[c.id] ?? NONE) === NONE).length;
      const question =
        missing > 0
          ? `${missing} critère${missing > 1 ? "s" : ""} sans niveau enseignant. Publier quand même ? L'étudiant·e sera notifié·e.`
          : null;
      if (question && !window.confirm(question)) return;
    }
    startTransition(() => dispatch(formData));
  }

  if (criteria.length === 0) return <EmptyState>Aucun critère.</EmptyState>;

  return (
    <form
      onSubmit={handleSubmit}
      onInput={(event) => {
        // Seuls les champs nommés comptent (les listes du sélecteur de commentaires types n'ont pas de nom)
        if ((event.target as HTMLInputElement).name) setDirty(true);
      }}
      data-dirty={dirty ? "true" : undefined}
      className="flex flex-col gap-4"
    >
      <ol className="flex flex-col divide-y divide-line">
        {criteria.map((criterion) => {
          const baseId = `feedback-${criterion.id}`;
          const current = levels[criterion.id] ?? NONE;
          const teacherLevel = current === NONE ? null : Number(current);
          const selfLevel = criterion.self?.level ?? null;
          const gap = isSignificantGap(selfLevel, teacherLevel);
          return (
            <li key={criterion.id} className="flex flex-col gap-3 py-5 first:pt-0">
              <CriterionHeading criterion={criterion} />

              {criterion.self === null ? (
                <p className="text-sm text-muted">Critère non renseigné par l&apos;étudiant·e.</p>
              ) : (
                <div className={showJustifications ? "grid gap-4 md:grid-cols-2" : "flex flex-col gap-3"}>
                  <div className="flex flex-col gap-2">
                    <LevelMeter level={criterion.self.level} prefix="Auto" />
                    {showJustifications &&
                      (criterion.self.justification ? (
                        <p className="max-w-prose break-words whitespace-pre-line">{criterion.self.justification}</p>
                      ) : (
                        <p className="text-sm text-muted">Pas de justification.</p>
                      ))}
                  </div>

                  <div
                    className={`flex flex-col gap-3 ${showJustifications ? "border-t border-line pt-3 md:border-t-0 md:border-l md:pt-0 md:pl-4" : ""}`}
                  >
                    <fieldset>
                      <legend className="label">
                        Niveau enseignant<span className="sr-only"> — {criterion.label}</span>
                      </legend>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {LEVELS.map((level) => {
                          const inputId = `${baseId}-level-${level.value}`;
                          return (
                            <label
                              key={level.value}
                              htmlFor={inputId}
                              className="flex min-h-11 cursor-pointer items-center gap-3 border border-line px-3 py-2 has-[:checked]:border-ink has-[:checked]:bg-sunken"
                            >
                              <input
                                id={inputId}
                                type="radio"
                                name={`teacherLevel:${criterion.id}`}
                                value={level.value}
                                checked={current === String(level.value)}
                                onChange={() => setLevels((prev) => ({ ...prev, [criterion.id]: String(level.value) }))}
                                className="size-5 shrink-0 accent-ink"
                              />
                              <span className="text-sm">
                                <span className="font-medium">{level.value}</span> — {level.label}
                              </span>
                            </label>
                          );
                        })}
                        <label
                          htmlFor={`${baseId}-level-none`}
                          className="flex min-h-11 cursor-pointer items-center gap-3 border border-dashed border-line px-3 py-2 has-[:checked]:border-ink sm:col-span-2"
                        >
                          <input
                            id={`${baseId}-level-none`}
                            type="radio"
                            name={`teacherLevel:${criterion.id}`}
                            value={NONE}
                            checked={current === NONE}
                            onChange={() => setLevels((prev) => ({ ...prev, [criterion.id]: NONE }))}
                            className="size-5 shrink-0 accent-ink"
                          />
                          <span className="text-sm text-muted">Sans niveau</span>
                        </label>
                      </div>
                    </fieldset>

                    <div aria-live="polite">
                      {gap && selfLevel != null && teacherLevel != null && (
                        <GapFlag self={selfLevel} teacher={teacherLevel} />
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <label htmlFor={`${baseId}-comment`} className="label mb-0">
                        Commentaire enseignant<span className="sr-only"> — {criterion.label}</span>{" "}
                        <span className="font-normal text-muted">(facultatif)</span>
                      </label>
                      <textarea
                        id={`${baseId}-comment`}
                        name={`teacherComment:${criterion.id}`}
                        defaultValue={criterion.teacherComment ?? ""}
                        maxLength={MAX_BODY}
                        rows={3}
                        className="input py-2"
                      />
                      <SnippetPicker snippets={snippets} targetId={`${baseId}-comment`} defaultTag={criterion.code} />
                    </div>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {editable.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button type="submit" name="intent" value="save" className="btn" disabled={pending}>
              {pending ? "Enregistrement…" : published ? "Enregistrer les modifications" : "Enregistrer (brouillon)"}
            </button>
            <button type="submit" name="intent" value="publish" className="btn btn-primary" disabled={pending}>
              {pending ? "Envoi…" : published ? "Republier et notifier" : "Publier le retour"}
            </button>
          </div>
          <p role="status" aria-live="polite" className={state && !state.ok ? "form-error" : "text-sm text-ok"}>
            {state ? (state.ok ? (state.message ?? "Enregistré") : state.error) : ""}
          </p>
          {dirty && !pending && <p className="text-sm text-warn">Modifications non enregistrées.</p>}
        </div>
      )}
    </form>
  );
}
