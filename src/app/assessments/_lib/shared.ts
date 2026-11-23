// Utilitaires partagés par les routes du slice « évaluation » (jalons, auto-évaluations, file de correction).
// Fonctions pures uniquement : ce module est importé côté serveur ET côté client.
import { levelLabel } from "@/lib/assessment";
import { isSignificantGap } from "@/lib/competences";

/** Résultat standard des Server Actions */
export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

/** Statut enregistré d'une auto-évaluation (affichage : `AssessmentStatusBadge` de @/components/ui) */
export type AssessmentStatusValue = "DRAFT" | "SUBMITTED";

const TIME_ZONE = "Europe/Paris";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: TIME_ZONE });
const dateTimeFormatter = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: TIME_ZONE,
});
const averageFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

export function formatDate(date: Date) {
  return dateFormatter.format(date);
}

export function formatDateTime(date: Date) {
  return dateTimeFormatter.format(date);
}

/** Moyenne des niveaux (1..4), ou null si aucun niveau */
export function averageLevel(levels: number[]): number | null {
  if (levels.length === 0) return null;
  return levels.reduce((sum, l) => sum + l, 0) / levels.length;
}

export function formatAverage(avg: number | null) {
  return avg === null ? "—" : `${averageFormatter.format(avg)} / 4`;
}

export function formatNumber(value: number) {
  return averageFormatter.format(value);
}

export function describeLevel(level: number) {
  return `${level}/4 — ${levelLabel(level)}`;
}

/** Premier message d'erreur lisible d'un résultat zod */
export function firstIssue(issues: { message: string }[], fallback = "Données invalides") {
  return issues[0]?.message ?? fallback;
}

/** Longueur maximale des textes libres (commentaires, justifications, commentaires types) */
export const MAX_BODY = 5000;

// ── Critères : code d'apprentissage critique ──────────────────

export type CriterionSource = {
  id: string;
  label: string;
  description: string | null;
  acCode: string | null;
  learning: { code: string; label: string } | null;
};

/** Critère prêt à afficher : le rattachement au référentiel l'emporte sur le code libre historique */
export type CriterionView = {
  id: string;
  label: string;
  description: string | null;
  code: string | null;
  learningLabel: string | null;
};

export function toCriterionView(c: CriterionSource): CriterionView {
  return {
    id: c.id,
    label: c.label,
    description: c.description,
    code: c.learning?.code ?? c.acCode ?? null,
    // Libellé officiel seulement s'il diffère du libellé du critère (sinon doublon à l'écran)
    learningLabel: c.learning && c.learning.label.trim() !== c.label.trim() ? c.learning.label : null,
  };
}

/** Sélection Prisma commune pour afficher un critère */
export const criterionSelect = {
  id: true,
  label: true,
  description: true,
  acCode: true,
  learning: { select: { code: true, label: true } },
} as const;

// ── Positionnement enseignant ─────────────────────────────────

export type FeedbackStatus = "NONE" | "DRAFT" | "PUBLISHED";

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  NONE: "Non commencé",
  DRAFT: "Brouillon",
  PUBLISHED: "Publié",
};

type TeacherItem = { teacherLevel: number | null; teacherComment: string | null };

export function feedbackStatus(a: { feedbackPublishedAt: Date | null; items: TeacherItem[] }): FeedbackStatus {
  if (a.feedbackPublishedAt) return "PUBLISHED";
  return a.items.some((i) => i.teacherLevel != null || !!i.teacherComment) ? "DRAFT" : "NONE";
}

/**
 * Retour « prêt » pour la publication groupée : chaque critère positionné par l'étudiant·e
 * a reçu un niveau enseignant (au moins un critère).
 */
export function isFeedbackReady(items: { teacherLevel: number | null }[]) {
  return items.length > 0 && items.every((i) => i.teacherLevel != null);
}

/** Nombre de critères avec un écart auto / enseignant significatif (≥ 2 niveaux) */
export function countSignificantGaps(items: { level: number; teacherLevel: number | null }[]) {
  return items.filter((i) => isSignificantGap(i.level, i.teacherLevel)).length;
}

// ── Banque de commentaires ────────────────────────────────────

export type SnippetView = { id: string; tag: string | null; body: string };

/** Ajoute un commentaire type à la fin d'un texte, séparé par un saut de ligne */
export function appendSnippet(current: string, snippet: string) {
  const base = current.replace(/\s+$/, "");
  return base === "" ? snippet : `${base}\n${snippet}`;
}

// ── Contribution entre pairs ──────────────────────────────────

/** Les évaluations entre pairs restent modifiables jusqu'à 7 jours après l'échéance du jalon */
export const PEER_REVIEW_GRACE_DAYS = 7;

export function peerReviewClosesAt(dueAt: Date | null): Date | null {
  return dueAt ? new Date(dueAt.getTime() + PEER_REVIEW_GRACE_DAYS * 86_400_000) : null;
}

export function isPeerReviewOpen(dueAt: Date | null, now: Date = new Date()) {
  const closesAt = peerReviewClosesAt(dueAt);
  return closesAt === null || now.getTime() <= closesAt.getTime();
}

/** Moyenne reçue jugée préoccupante */
export const PEER_LOW_THRESHOLD = 1.5;
