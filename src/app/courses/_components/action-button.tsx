"use client";

import { useActionState } from "react";
import { cx } from "@/components/ui/cx";
import type { FormAction } from "../_lib/action-state";

type Props = {
  action: FormAction;
  label: string;
  pendingLabel?: string;
  /** Demande une confirmation avant d'envoyer (actions destructrices) */
  confirmMessage?: string;
  /** Libellé accessible si le texte visible est ambigu (ex. « ↑ ») */
  ariaLabel?: string;
  variant?: "default" | "primary" | "danger" | "ghost";
  /** Classes du formulaire englobant */
  className?: string;
  /** Classes ajoutées au bouton (ex. pleine largeur dans un menu) */
  buttonClassName?: string;
};

const VARIANT: Record<NonNullable<Props["variant"]>, string> = {
  default: "btn",
  primary: "btn btn-primary",
  danger: "btn btn-danger",
  ghost: "btn btn-ghost",
};

/** Bouton isolé qui déclenche une Server Action et affiche son erreur éventuelle */
export function ActionButton({
  action,
  label,
  pendingLabel,
  confirmMessage,
  ariaLabel,
  variant = "default",
  className,
  buttonClassName,
}: Props) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirmMessage && !window.confirm(confirmMessage)) e.preventDefault();
      }}
    >
      <button type="submit" className={cx(VARIANT[variant], buttonClassName)} disabled={pending} aria-label={ariaLabel}>
        {pending ? (pendingLabel ?? label) : label}
      </button>
      {state && !state.ok && (
        <p role="alert" className="form-error mt-1">
          {state.error}
        </p>
      )}
    </form>
  );
}
