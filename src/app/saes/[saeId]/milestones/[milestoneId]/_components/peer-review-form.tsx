"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import { CONTRIBUTION_LEVELS } from "@/lib/assessment";
import { MAX_BODY, type ActionResult } from "@/app/assessments/_lib/shared";

type Props = {
  /** `savePeerReviews.bind(null, milestoneId)` */
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  teammates: { id: string; name: string }[];
  /** Mes évaluations déjà enregistrées, par coéquipier */
  existing: Record<string, { contribution: number; comment: string | null }>;
};

export function PeerReviewForm({ action, teammates, existing }: Props) {
  const [state, dispatch, pending] = useActionState(action, null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <ol className="flex flex-col divide-y divide-line">
        {teammates.map((mate) => {
          const baseId = `peer-${mate.id}`;
          const mine = existing[mate.id];
          return (
            <li key={mate.id} className="py-5 first:pt-0">
              <fieldset>
                <legend className="float-left w-full font-semibold break-words">{mate.name}</legend>
                <div className="clear-both flex flex-col gap-3 pt-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {CONTRIBUTION_LEVELS.map((level) => {
                      const inputId = `${baseId}-${level.value}`;
                      return (
                        <label
                          key={level.value}
                          htmlFor={inputId}
                          className="flex min-h-11 cursor-pointer items-start gap-3 border border-line p-3 has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
                        >
                          <input
                            id={inputId}
                            type="radio"
                            name={`contribution:${mate.id}`}
                            value={level.value}
                            defaultChecked={mine?.contribution === level.value}
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
                    <label htmlFor={`${baseId}-comment`} className="label">
                      Commentaire <span className="font-normal text-muted">(facultatif, lu par l&apos;équipe pédagogique seulement)</span>
                      <span className="sr-only"> — {mate.name}</span>
                    </label>
                    <textarea
                      id={`${baseId}-comment`}
                      name={`peerComment:${mate.id}`}
                      defaultValue={mine?.comment ?? ""}
                      maxLength={MAX_BODY}
                      rows={3}
                      className="input py-2"
                    />
                  </div>
                </div>
              </fieldset>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-col items-start gap-2">
        <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer mes évaluations"}
        </button>
        <p role="status" aria-live="polite" className={state && !state.ok ? "form-error" : "text-sm text-ok"}>
          {state ? (state.ok ? (state.message ?? "Enregistré") : state.error) : ""}
        </p>
      </div>
    </form>
  );
}
