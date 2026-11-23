"use client";

import { useActionState } from "react";
import type { FormAction } from "../_lib/action-state";

export function AddEditorForm({ action }: { action: FormAction }) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <label htmlFor="editor-email" className="label">
        E-mail d&apos;un enseignant
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="editor-email"
          name="email"
          type="email"
          required
          autoComplete="off"
          maxLength={320}
          className="input"
        />
        <button type="submit" className="btn shrink-0" disabled={pending}>
          {pending ? "Ajout…" : "Ajouter"}
        </button>
      </div>
      <p role="status" aria-live="polite" className={state && !state.ok ? "form-error" : "text-sm text-ok"}>
        {state ? (state.ok ? "Co-éditeur ajouté." : state.error) : ""}
      </p>
    </form>
  );
}
