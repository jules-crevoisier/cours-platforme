import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * StatusBadge — libellé court précédé d'un carré de couleur (classe `.badge`).
 * La couleur n'est jamais seule porteuse du sens (le libellé est obligatoire).
 * Un seul badge par ligne : s'il en faut deux, l'information est mal placée.
 *
 *   <StatusBadge tone="ok">Soumise</StatusBadge>
 *   <AssessmentStatusBadge status={assessment?.status ?? "NONE"} />
 */
export type StatusTone = "neutral" | "accent" | "ok" | "warn" | "danger";

const TONE_CLASS: Record<StatusTone, string> = {
  neutral: "",
  accent: "badge-accent",
  ok: "badge-ok",
  warn: "badge-warn",
  danger: "badge-danger",
};

type StatusBadgeProps = { tone?: StatusTone; children: ReactNode; className?: string };

export function StatusBadge({ tone = "neutral", children, className }: StatusBadgeProps) {
  return <span className={cx("badge", TONE_CLASS[tone], className)}>{children}</span>;
}

export type AssessmentStatusValue = "NONE" | "DRAFT" | "SUBMITTED";

export const ASSESSMENT_STATUS: Record<AssessmentStatusValue, { tone: StatusTone; label: string }> = {
  NONE: { tone: "neutral", label: "Non commencée" },
  DRAFT: { tone: "warn", label: "Brouillon" },
  SUBMITTED: { tone: "ok", label: "Soumise" },
};

/** Statut d'une auto-évaluation ; « NONE » = aucune auto-évaluation créée */
export function AssessmentStatusBadge({ status, className }: { status: AssessmentStatusValue; className?: string }) {
  const s = ASSESSMENT_STATUS[status];
  return (
    <StatusBadge tone={s.tone} className={className}>
      <span className="sr-only">Auto-évaluation : </span>
      {s.label}
    </StatusBadge>
  );
}
