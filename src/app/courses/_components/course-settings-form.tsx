"use client";

import { useActionState } from "react";
import type { FormAction } from "../_lib/action-state";

type Props = {
  action: FormAction;
  course: { title: string; summary: string | null; published: boolean };
};

export function CourseSettingsForm({ action, course }: Props) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label htmlFor="course-title" className="label">
          Titre
        </label>
        <input id="course-title" name="title" required maxLength={190} defaultValue={course.title} className="input" />
      </div>
      <div>
        <label htmlFor="course-summary" className="label">
          Résumé
        </label>
        <textarea
          id="course-summary"
          name="summary"
          rows={4}
          maxLength={5000}
          defaultValue={course.summary ?? ""}
          className="input py-2"
        />
      </div>
      <label className="flex min-h-11 items-center gap-3">
        <input type="checkbox" name="published" defaultChecked={course.published} className="size-5 shrink-0" />
        <span>Publié (visible par les étudiants)</span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
        <p role="status" aria-live="polite" className={state && !state.ok ? "form-error" : "text-sm text-ok"}>
          {state ? (state.ok ? "Paramètres enregistrés." : state.error) : ""}
        </p>
      </div>
    </form>
  );
}
