"use client";

import { startTransition, useActionState, useEffect, useId, useRef, type FormEvent } from "react";
import { MAX_BODY, type ActionResult } from "@/app/assessments/_lib/shared";

type Props = {
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  initial?: { tag: string | null; body: string };
  submitLabel: string;
  /** Création : vider le formulaire après succès */
  resetOnSuccess?: boolean;
  /** id d'un <datalist> des étiquettes existantes */
  tagListId?: string;
};

export function SnippetForm({ action, initial, submitLabel, resetOnSuccess = false, tagListId }: Props) {
  const uid = useId();
  const [state, dispatch, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state?.ok) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <label htmlFor={`${uid}-tag`} className="label">
          Étiquette <span className="font-normal text-muted">(facultatif)</span>
        </label>
        <input
          id={`${uid}-tag`}
          name="tag"
          type="text"
          defaultValue={initial?.tag ?? ""}
          maxLength={60}
          list={tagListId}
          autoComplete="off"
          placeholder="ex. AC14.02, accessibilité"
          className="input"
        />
      </div>
      <div>
        <label htmlFor={`${uid}-body`} className="label">
          Commentaire
        </label>
        <textarea
          id={`${uid}-body`}
          name="body"
          defaultValue={initial?.body ?? ""}
          required
          maxLength={MAX_BODY}
          rows={4}
          className="input py-2"
        />
      </div>
      <div className="flex flex-col items-start gap-2">
        <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={pending}>
          {pending ? "Enregistrement…" : submitLabel}
        </button>
        <p role="status" aria-live="polite" className={state && !state.ok ? "form-error" : "text-sm text-ok"}>
          {state ? (state.ok ? (state.message ?? "Enregistré") : state.error) : ""}
        </p>
      </div>
    </form>
  );
}
