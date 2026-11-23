"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import { LEVELS } from "@/lib/assessment";
import { EmptyState } from "@/components/ui";
import type { ActionResult, CriterionView } from "@/app/assessments/_lib/shared";

type Criterion = CriterionView;
type Existing = { level: number; justification: string | null };

type Props = {
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  criteria: Criterion[];
  existingItems: Record<string, Existing>;
  reflection: string;
};

export function AssessForm({ action, criteria, existingItems, reflection }: Props) {
  const [state, dispatch, pending] = useActionState(action, null);

  // Soumission manuelle : le formulaire n'est pas réinitialisé, les saisies restent en cas d'erreur
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    if (
      formData.get("intent") === "submit" &&
      !window.confirm(
        "Soumettre votre auto-évaluation ? Vous ne pourrez plus la modifier, sauf si un enseignant la rouvre.",
      )
    ) {
      return;
    }
    startTransition(() => dispatch(formData));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-10">
      {criteria.length === 0 ? (
        <EmptyState>Aucun critère.</EmptyState>
      ) : (
        <ol className="flex flex-col divide-y divide-line">
          {criteria.map((criterion) => {
            const existing = existingItems[criterion.id];
            const legendId = `criterion-${criterion.id}`;
            return (
              <li key={criterion.id} className="py-6 first:pt-0">
                <fieldset aria-describedby={criterion.description ? `${legendId}-desc` : undefined}>
                  <legend className="float-left w-full">
                    {criterion.code && <span className="block text-sm text-muted">{criterion.code}</span>}
                    <span className="block font-semibold break-words">{criterion.label}</span>
                    {criterion.learningLabel && (
                      <span className="mt-1 block text-sm font-normal break-words text-muted">{criterion.learningLabel}</span>
                    )}
                  </legend>
                  <div className="clear-both flex flex-col gap-3 pt-2">
                    {criterion.description && (
                      <p id={`${legendId}-desc`} className="text-sm whitespace-pre-line break-words text-muted">
                        {criterion.description}
                      </p>
                    )}

                    <div className="grid gap-2 sm:grid-cols-2">
                      {LEVELS.map((level) => {
                        const inputId = `${legendId}-level-${level.value}`;
                        return (
                          <label
                            key={level.value}
                            htmlFor={inputId}
                            className="flex min-h-11 cursor-pointer items-start gap-3 border border-line p-3 has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
                          >
                            <input
                              id={inputId}
                              type="radio"
                              name={`level:${criterion.id}`}
                              value={level.value}
                              defaultChecked={existing?.level === level.value}
                              required
                              className="mt-1 size-5 shrink-0 accent-accent"
                            />
                            <span className="flex flex-col">
                              <span className="font-medium">
                                {level.value} — {level.label}
                              </span>
                              <span className="text-sm text-muted">{level.hint}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>

                    <div>
                      <label htmlFor={`${legendId}-justification`} className="label">
                        Justification
                      </label>
                      <textarea
                        id={`${legendId}-justification`}
                        name={`justification:${criterion.id}`}
                        defaultValue={existing?.justification ?? ""}
                        maxLength={5000}
                        rows={4}
                        className="input py-2"
                      />
                    </div>
                  </div>
                </fieldset>
              </li>
            );
          })}
        </ol>
      )}

      <div>
        <label htmlFor="reflection" className="label">
          Réflexion globale
        </label>
        <textarea
          id="reflection"
          name="reflection"
          defaultValue={reflection}
          maxLength={10000}
          rows={6}
          className="input py-2"
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="submit" name="intent" value="draft" formNoValidate className="btn" disabled={pending}>
            {pending ? "Enregistrement…" : "Enregistrer le brouillon"}
          </button>
          <button type="submit" name="intent" value="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Envoi…" : "Soumettre"}
          </button>
        </div>
        <p
          role="status"
          aria-live="polite"
          className={state && !state.ok ? "form-error" : "text-sm text-ok"}
        >
          {state ? (state.ok ? (state.message ?? "Enregistré") : state.error) : ""}
        </p>
      </div>
    </form>
  );
}
