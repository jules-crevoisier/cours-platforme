"use client";

import { useActionState, useId } from "react";
import type { FormAction } from "../_lib/action-state";

/** Poser une question sous une page (option anonyme vis-à-vis des autres étudiants) */
export function QuestionForm({ action }: { action: FormAction }) {
  const [state, formAction, pending] = useActionState(action, null);
  const id = useId();
  const values = state && !state.ok ? state.values : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div>
        <label htmlFor={`${id}-body`} className="label">
          Votre question
        </label>
        <textarea
          id={`${id}-body`}
          name="body"
          required
          rows={3}
          maxLength={5000}
          defaultValue={values?.body}
          className="input py-2"
        />
      </div>
      <label className="flex min-h-11 items-center gap-3">
        <input type="checkbox" name="anonymous" defaultChecked={values?.anonymous === "on"} className="size-5 shrink-0" />
        <span>Anonyme pour les autres étudiants (pas pour l&apos;équipe du cours)</span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Envoi…" : "Poser la question"}
        </button>
        <p role="status" aria-live="polite" className={state && !state.ok ? "form-error" : "text-sm text-ok"}>
          {state ? (state.ok ? "Question envoyée." : state.error) : ""}
        </p>
      </div>
    </form>
  );
}
