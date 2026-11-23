"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import type { ActionResult } from "@/app/me/portfolio/_lib/shared";
import {
  SHOWCASE_CATEGORIES,
  SHOWCASE_CATEGORY_LABELS,
  SHOWCASE_SUMMARY_MAX,
  SHOWCASE_TITLE_MAX,
} from "@/app/vitrine/_lib/showcase";

type Initial = {
  title: string;
  summary: string;
  url: string;
  imageUrl: string;
  category: string;
};

type Props = {
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  initial: Initial;
  /** Une demande existe déjà (en attente ou publiée) : libellés de mise à jour */
  isUpdate: boolean;
  isPublished: boolean;
};

export function ShowcaseForm({ action, initial, isUpdate, isPublished }: Props) {
  const [state, dispatch, pending] = useActionState(action, null);
  const [summaryLength, setSummaryLength] = useState(initial.summary.length);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label={isUpdate ? "Modifier la proposition" : "Proposer le projet à la vitrine"}
      className="flex flex-col gap-4"
    >
      {isPublished && (
        <p className="text-sm text-warn">Toute modification retire le projet de la vitrine jusqu&apos;à validation.</p>
      )}

      <div>
        <label htmlFor="showcase-title" className="label">
          Titre du projet <span className="text-danger">*</span>
        </label>
        <input
          id="showcase-title"
          name="title"
          type="text"
          required
          minLength={3}
          maxLength={SHOWCASE_TITLE_MAX}
          defaultValue={initial.title}
          className="input"
        />
      </div>

      <div>
        <label htmlFor="showcase-summary" className="label">
          Résumé <span className="text-danger">*</span>
        </label>
        <textarea
          id="showcase-summary"
          name="summary"
          required
          minLength={20}
          maxLength={SHOWCASE_SUMMARY_MAX}
          rows={5}
          defaultValue={initial.summary}
          onChange={(e) => setSummaryLength(e.currentTarget.value.length)}
          aria-describedby="showcase-summary-count"
          className="input py-2"
        />
        <p id="showcase-summary-count" className="mt-1 text-xs text-muted">
          {summaryLength} / {SHOWCASE_SUMMARY_MAX} caractères
        </p>
      </div>

      <div>
        <label htmlFor="showcase-url" className="label">
          Lien vers le projet <span className="text-danger">*</span>{" "}
          <span className="font-normal text-muted">(accessible sans connexion)</span>
        </label>
        <input
          id="showcase-url"
          name="url"
          type="url"
          inputMode="url"
          required
          maxLength={2048}
          autoComplete="off"
          spellCheck={false}
          defaultValue={initial.url}
          placeholder="https://"
          className="input"
        />
      </div>

      <div>
        <label htmlFor="showcase-image" className="label">
          Image d&apos;illustration <span className="font-normal text-muted">(facultatif, https://)</span>
        </label>
        <input
          id="showcase-image"
          name="imageUrl"
          type="url"
          inputMode="url"
          maxLength={2048}
          autoComplete="off"
          spellCheck={false}
          defaultValue={initial.imageUrl}
          placeholder="https://"
          className="input"
        />
      </div>

      <div>
        <label htmlFor="showcase-category" className="label">
          Catégorie <span className="text-danger">*</span>
        </label>
        <select
          id="showcase-category"
          name="category"
          required
          defaultValue={initial.category}
          className="input"
        >
          <option value="" disabled>
            Choisir une catégorie
          </option>
          {SHOWCASE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {SHOWCASE_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex min-h-11 items-start gap-3 border border-line bg-sunken p-3">
        <input
          id="showcase-consent"
          name="consent"
          type="checkbox"
          required
          className="mt-0.5 size-5 shrink-0 accent-accent"
        />
        <label htmlFor="showcase-consent" className="text-sm">
          <strong className="font-semibold">Les noms des membres du groupe seront affichés publiquement.</strong>{" "}
          J&apos;ai l&apos;accord de tous les membres (affichage « Prénom N. »).
        </label>
      </div>

      <div className="flex flex-col items-start gap-2">
        <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={pending}>
          {pending ? "Envoi…" : isUpdate ? "Envoyer les modifications" : "Envoyer la proposition"}
        </button>
        <p role="status" aria-live="polite" className={state && !state.ok ? "form-error" : "text-sm text-ok"}>
          {state ? (state.ok ? (state.message ?? "Enregistré") : state.error) : ""}
        </p>
      </div>
    </form>
  );
}
