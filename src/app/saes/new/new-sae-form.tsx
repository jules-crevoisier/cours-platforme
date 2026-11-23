"use client";

import { useState } from "react";
import { createSae } from "../actions";
import { ActionForm, SubmitButton } from "../_components/action-form";
import { SaeFields, type CohortOption, type CourseOption } from "../_components/sae-fields";

export type SaeTemplateOption = { code: string; title: string; semester: number; acs: readonly string[] };

type Props = { courses: CourseOption[]; cohorts: CohortOption[]; templates: readonly SaeTemplateOption[] };

/** Création d'une SAÉ, éventuellement pré-remplie depuis une SAÉ du programme national */
export function NewSaeForm({ courses, cohorts, templates }: Props) {
  const [templateCode, setTemplateCode] = useState("");
  const template = templates.find((t) => t.code === templateCode);

  return (
    <ActionForm action={createSae} className="flex flex-col gap-6" aria-label="Créer une SAÉ">
      <div>
        <label htmlFor="new-sae-template" className="label">
          Modèle du programme national <span className="font-normal text-muted">(optionnel)</span>
        </label>
        <select
          id="new-sae-template"
          name="templateCode"
          className="input"
          value={templateCode}
          onChange={(e) => setTemplateCode(e.target.value)}
        >
          <option value="">Aucun modèle</option>
          {[...new Set(templates.map((t) => t.semester))].map((s) => (
            <optgroup key={s} label={`Semestre ${s}`}>
              {templates.filter((t) => t.semester === s).map((t) => (
                <option key={t.code} value={t.code}>
                  {t.code} — {t.title}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Changer de modèle réinitialise les champs pré-remplis */}
      <SaeFields
        key={templateCode || "blank"}
        idPrefix="new-sae"
        courses={courses}
        cohorts={cohorts}
        defaults={template ? { code: template.code, title: template.title, semester: template.semester } : undefined}
      />

      <div>
        <SubmitButton pendingLabel="Création…">Créer la SAÉ</SubmitButton>
      </div>
    </ActionForm>
  );
}
