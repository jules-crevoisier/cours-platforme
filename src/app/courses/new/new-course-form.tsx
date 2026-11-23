"use client";

import { useActionState } from "react";
import { createCourse } from "../actions";

export function NewCourseForm() {
  const [state, formAction, pending] = useActionState(createCourse, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label htmlFor="new-course-title" className="label">
          Titre
        </label>
        <input id="new-course-title" name="title" required maxLength={190} className="input" />
      </div>
      <div>
        <label htmlFor="new-course-summary" className="label">
          Résumé <span className="font-normal text-muted">(facultatif)</span>
        </label>
        <textarea id="new-course-summary" name="summary" rows={4} maxLength={5000} className="input py-2" />
      </div>
      {state && !state.ok && (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      )}
      <div>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Création…" : "Créer le cours"}
        </button>
      </div>
    </form>
  );
}
