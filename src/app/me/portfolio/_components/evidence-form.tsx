"use client";

import { startTransition, useActionState, useEffect, useId, useRef, type FormEvent } from "react";
import { LEVELS } from "@/lib/assessment";
import type { ActionResult } from "../_lib/shared";

export type LearningOptionGroup = {
  label: string;
  options: { id: string; code: string; label: string }[];
};

type Initial = {
  id: string;
  learningId: string;
  title: string;
  url: string;
  reflection: string;
  level: number | null;
};

type Props = {
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  groups: LearningOptionGroup[];
  /** Trace existante (modification) — sinon création */
  initial?: Initial;
  /** AC présélectionné (lien « Ajouter une trace » depuis /me/competences) */
  defaultLearningId?: string;
};

function shorten(text: string, max = 90) {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export function EvidenceForm({ action, groups, initial, defaultLearningId }: Props) {
  const [state, dispatch, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  const uid = useId();
  const isEdit = !!initial;

  // Création réussie : on vide le formulaire (les saisies restent en cas d'erreur)
  useEffect(() => {
    if (state?.ok && !isEdit) formRef.current?.reset();
  }, [state, isEdit]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  }

  const f = (name: string) => `${uid}-${name}`;

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4 print:hidden">
      {initial && <input type="hidden" name="id" value={initial.id} />}

      <div>
        <label htmlFor={f("learning")} className="label">
          Apprentissage critique <span className="text-danger">*</span>
        </label>
        <select
          id={f("learning")}
          name="learningId"
          required
          defaultValue={initial?.learningId ?? defaultLearningId ?? ""}
          className="input"
        >
          <option value="" disabled>
            Choisir un AC
          </option>
          {groups.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.code} — {shorten(o.label)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor={f("title")} className="label">
          Titre de la trace <span className="text-danger">*</span>
        </label>
        <input
          id={f("title")}
          name="title"
          type="text"
          required
          minLength={3}
          maxLength={191}
          defaultValue={initial?.title}
          placeholder="ex. Maquette responsive de la page d'accueil"
          className="input"
        />
      </div>

      <div>
        <label htmlFor={f("url")} className="label">
          Lien vers la preuve <span className="font-normal text-muted">(facultatif)</span>
        </label>
        <input
          id={f("url")}
          name="url"
          type="url"
          inputMode="url"
          maxLength={2048}
          autoComplete="off"
          spellCheck={false}
          defaultValue={initial?.url}
          placeholder="https://"
          className="input"
        />
      </div>

      <div>
        <label htmlFor={f("reflection")} className="label">
          Analyse réflexive <span className="font-normal text-muted">(facultatif)</span>
        </label>
        <textarea
          id={f("reflection")}
          name="reflection"
          rows={4}
          maxLength={5000}
          defaultValue={initial?.reflection}
          className="input py-2"
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="label">
          Auto-positionnement <span className="text-danger">*</span>
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {LEVELS.map((l) => (
            <label
              key={l.value}
              className="flex min-h-11 cursor-pointer items-start gap-3 border border-line bg-surface p-3 has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
            >
              <input
                type="radio"
                name="level"
                value={l.value}
                required
                defaultChecked={initial?.level === l.value}
                className="mt-1 size-4 shrink-0 accent-accent"
              />
              <span className="flex flex-col">
                <span className="text-sm font-medium">
                  {l.value} {l.label}
                </span>
                <span className="text-xs text-muted">{l.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col items-start gap-2">
        <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={pending}>
          {pending ? "Enregistrement…" : isEdit ? "Enregistrer les modifications" : "Ajouter la trace"}
        </button>
        <p role="status" aria-live="polite" className={state && !state.ok ? "form-error" : "text-sm text-ok"}>
          {state ? (state.ok ? (state.message ?? "Enregistré") : state.error) : ""}
        </p>
      </div>
    </form>
  );
}
