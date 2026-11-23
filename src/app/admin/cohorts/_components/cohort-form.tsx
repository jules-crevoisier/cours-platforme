"use client";

import { useId } from "react";
import type { FormAction } from "@/app/admin/users/_lib/form-result";
import { ActionForm, SubmitButton } from "@/app/admin/users/_components/action-form";

type Props = {
  action: FormAction;
  parcoursOptions: { value: string; label: string }[];
  initial: { name: string; year: number; parcours: string | null; academicYear: string };
  submitLabel: string;
  pendingLabel: string;
  resetOnSuccess?: boolean;
};

/** Champs d'une promo (création et modification) */
export function CohortForm({ action, parcoursOptions, initial, submitLabel, pendingLabel, resetOnSuccess = false }: Props) {
  const id = useId();

  return (
    <ActionForm action={action} resetOnSuccess={resetOnSuccess} className="flex flex-col gap-4">
      <div>
        <label htmlFor={`${id}-name`} className="label">
          Nom de la promo
        </label>
        <input
          id={`${id}-name`}
          name="name"
          required
          minLength={2}
          maxLength={120}
          defaultValue={initial.name}
          placeholder="MMI 1 — TD A"
          className="input"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor={`${id}-year`} className="label">
            Année de BUT
          </label>
          <select id={`${id}-year`} name="year" defaultValue={String(initial.year)} className="input">
            <option value="1">BUT 1</option>
            <option value="2">BUT 2</option>
            <option value="3">BUT 3</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`${id}-parcours`} className="label">
            Parcours
          </label>
          <select id={`${id}-parcours`} name="parcours" defaultValue={initial.parcours ?? ""} className="input">
            {parcoursOptions.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="sm:max-w-60">
        <label htmlFor={`${id}-ay`} className="label">
          Année universitaire
        </label>
        <input
          id={`${id}-ay`}
          name="academicYear"
          required
          inputMode="numeric"
          pattern="\d{4}-\d{4}"
          maxLength={9}
          defaultValue={initial.academicYear}
          placeholder="2026-2027"
          className="input"
          aria-describedby={`${id}-ay-hint`}
        />
        <p id={`${id}-ay-hint`} className="mt-1 text-sm text-muted">
          Format 2026-2027.
        </p>
      </div>
      <div>
        <SubmitButton pendingLabel={pendingLabel}>{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
