// Petits composants d'affichage (sans état) réutilisés par les pages du slice.
// Le statut d'une auto-évaluation : `AssessmentStatusBadge` de @/components/ui (implémentation unique).
import { levelLabel } from "@/lib/assessment";
import { LINK_STATUS_LABELS, type LinkCheckStatus } from "@/lib/link-check-core";
import { StatusBadge, type StatusTone } from "@/components/ui";
import { FEEDBACK_STATUS_LABELS, formatDateTime, type CriterionView, type FeedbackStatus } from "./shared";

const FEEDBACK_TONE: Record<FeedbackStatus, StatusTone> = { NONE: "neutral", DRAFT: "warn", PUBLISHED: "ok" };

/** Statut du retour enseignant : Non commencé / Brouillon / Publié */
export function FeedbackStatusBadge({ status }: { status: FeedbackStatus }) {
  return <StatusBadge tone={FEEDBACK_TONE[status]}>{FEEDBACK_STATUS_LABELS[status]}</StatusBadge>;
}

/**
 * Indicateur visuel 1..4 accompagné du texte (niveau + libellé).
 * `self` = auto-positionnement (accent), `teacher` = enseignant (encre) — le préfixe textuel distingue les deux.
 */
export function LevelMeter({
  level,
  tone = "self",
  prefix,
}: {
  level: number;
  tone?: "self" | "teacher";
  prefix?: string;
}) {
  const filled = tone === "teacher" ? "border-ink bg-ink" : "border-accent bg-accent";
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="inline-flex gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((step) => (
          <span key={step} className={`h-3 w-5 border ${step <= level ? filled : "border-line bg-bg"}`} />
        ))}
      </span>
      <span className="text-sm font-medium">
        {prefix ? `${prefix} : ` : ""}
        {level}/4 — {levelLabel(level)}
      </span>
    </span>
  );
}

/** Écart auto / enseignant ≥ 2 niveaux : signalé par un texte, pas seulement une couleur */
export function GapFlag({ self, teacher }: { self: number; teacher: number }) {
  return (
    <StatusBadge tone="warn">
      Écart important
      <span className="sr-only">
        {" "}
        (auto {self}, enseignant {teacher})
      </span>
    </StatusBadge>
  );
}

/** Code d'AC (référentiel prioritaire) + libellé du critère + intitulé de l'AC */
export function CriterionHeading({
  criterion,
  level = 3,
}: {
  criterion: Pick<CriterionView, "code" | "label" | "learningLabel">;
  level?: 3 | 4;
}) {
  const Heading = level === 3 ? "h3" : "h4";
  return (
    <div className="flex flex-col gap-1">
      {criterion.code && <span className="text-sm text-muted">{criterion.code}</span>}
      <Heading className="text-base break-words">{criterion.label}</Heading>
      {criterion.learningLabel && <p className="text-sm break-words text-muted">{criterion.learningLabel}</p>}
    </div>
  );
}

const LINK_TONE: Record<LinkCheckStatus, StatusTone> = {
  OK: "ok",
  PRIVATE: "warn",
  BROKEN: "danger",
  UNREACHABLE: "warn",
};

/**
 * Résultat de la vérification automatique d'un lien de dépôt : un seul badge.
 * Le détail (explication, code HTTP, date de vérification) est dans `title` et lu par les lecteurs d'écran.
 */
export function LinkStatusBadge({
  status,
  checkedAt,
  note,
  http,
}: {
  status: LinkCheckStatus | null;
  checkedAt?: Date | null;
  note?: string | null;
  http?: number | null;
}) {
  if (!status) return <StatusBadge>Non vérifié</StatusBadge>;
  const detail = [
    status !== "OK" ? note : null,
    http != null ? `HTTP ${http}` : null,
    checkedAt ? `Vérifié le ${formatDateTime(checkedAt)}` : null,
  ]
    .filter(Boolean)
    .join(". ");
  return (
    <span title={detail || undefined}>
      <StatusBadge tone={LINK_TONE[status]}>{LINK_STATUS_LABELS[status]}</StatusBadge>
      {detail && <span className="sr-only"> ({detail})</span>}
    </span>
  );
}
