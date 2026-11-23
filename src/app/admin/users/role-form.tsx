"use client";

import { useId } from "react";
import type { Role } from "@/lib/permissions";
import type { FormAction } from "./_lib/form-result";
import { ActionForm, SubmitButton } from "./_components/action-form";

type Props = {
  action: FormAction;
  userName: string;
  currentRole: Role;
  roles: { value: Role; label: string }[];
  /** Empêche l'admin connecté de se rétrograder (vérifié aussi côté serveur) */
  locked?: boolean;
};

export function RoleForm({ action, userName, currentRole, roles, locked = false }: Props) {
  const id = useId();

  return (
    <ActionForm action={action} className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium md:sr-only">
        Rôle <span className="sr-only">de {userName}</span>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <select id={id} name="role" defaultValue={currentRole} disabled={locked} className="input w-auto min-w-0 flex-1 sm:flex-none">
          {roles.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <SubmitButton className="btn" pendingLabel="Envoi…" disabled={locked}>
          Appliquer
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
