"use client";

import { useState } from "react";
import type { FormAction } from "@/app/admin/users/_lib/form-result";
import { ActionForm, SubmitButton } from "@/app/admin/users/_components/action-form";

type Props = {
  action: FormAction;
  allowGlobal: boolean;
  cohorts: { id: string; label: string }[];
};

/** Rédaction d'une annonce (globale : administrateurs ; promo : équipe pédagogique) */
export function AnnouncementForm({ action, allowGlobal, cohorts }: Props) {
  const allowCohort = cohorts.length > 0;
  const [scope, setScope] = useState<"GLOBAL" | "COHORT">(allowCohort || !allowGlobal ? "COHORT" : "GLOBAL");

  if (!allowGlobal && !allowCohort) {
    return <p className="text-muted">Aucune promo.</p>;
  }

  return (
    <ActionForm action={action} resetOnSuccess className="flex flex-col gap-4">
      {allowGlobal ? (
        <fieldset className="flex flex-col gap-1">
          <legend className="label">Destinataires</legend>
          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <input
              type="radio"
              name="scope"
              value="COHORT"
              checked={scope === "COHORT"}
              onChange={() => setScope("COHORT")}
              disabled={!allowCohort}
              className="size-5"
            />
            <span>
              Une promo
              {!allowCohort && <span className="text-muted"> (aucune)</span>}
            </span>
          </label>
          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <input type="radio" name="scope" value="GLOBAL" checked={scope === "GLOBAL"} onChange={() => setScope("GLOBAL")} className="size-5" />
            <span>Tout le monde</span>
          </label>
        </fieldset>
      ) : (
        <input type="hidden" name="scope" value="COHORT" />
      )}

      {scope === "COHORT" ? (
        <div>
          <label htmlFor="announcement-cohort" className="label">
            Promo
          </label>
          <select id="announcement-cohort" name="cohortId" required defaultValue="" className="input">
            <option value="" disabled>
              Choisir une promo…
            </option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <input type="hidden" name="cohortId" value="" />
      )}

      <div>
        <label htmlFor="announcement-title" className="label">
          Titre
        </label>
        <input id="announcement-title" name="title" required minLength={3} maxLength={190} className="input" />
      </div>

      <div>
        <label htmlFor="announcement-body" className="label">
          Message
        </label>
        <textarea
          id="announcement-body"
          name="body"
          required
          rows={6}
          maxLength={5000}
          className="input"
        />
      </div>

      <label className="flex min-h-11 cursor-pointer items-center gap-3">
        <input type="checkbox" name="pinned" className="size-5" />
        <span>Épingler en haut de l&apos;accueil</span>
      </label>

      <div>
        <SubmitButton pendingLabel="Publication…">Publier l&apos;annonce</SubmitButton>
      </div>
    </ActionForm>
  );
}
