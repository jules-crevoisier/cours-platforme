"use client";

import { useActionState, useId } from "react";
import type { FormAction } from "../_lib/action-state";

/** Nouvelle annonce de cours (texte brut, épinglable) */
export function AnnouncementForm({ action }: { action: FormAction }) {
  const [state, formAction, pending] = useActionState(action, null);
  const id = useId();
  const values = state && !state.ok ? state.values : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div>
        <label htmlFor={`${id}-title`} className="label">
          Titre
        </label>
        <input id={`${id}-title`} name="title" required maxLength={190} defaultValue={values?.title} className="input" />
      </div>
      <div>
        <label htmlFor={`${id}-body`} className="label">
          Texte
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
        <input type="checkbox" name="pinned" defaultChecked={values?.pinned === "on"} className="size-5 shrink-0" />
        <span>Épingler en tête</span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Publication…" : "Publier"}
        </button>
        <p role="status" aria-live="polite" className={state && !state.ok ? "form-error" : "text-sm text-ok"}>
          {state ? (state.ok ? "Annonce publiée." : state.error) : ""}
        </p>
      </div>
    </form>
  );
}
