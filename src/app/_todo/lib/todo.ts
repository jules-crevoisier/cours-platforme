// Logique pure de la page « À faire » (testée dans todo.test.ts).

export type Bucket = "overdue" | "week" | "later";

export const BUCKET_LABELS: Record<Bucket, string> = {
  overdue: "En retard",
  week: "Cette semaine",
  later: "Plus tard",
};

const DAY_MS = 86_400_000;

/** Jalons en retard remontés dans la liste (au-delà, ils ne sont plus actionnables) */
export const OVERDUE_LOOKBACK_DAYS = 60;

/** En retard (échéance passée), cette semaine (7 prochains jours), plus tard (au-delà ou sans date) */
export function bucketFor(due: Date | null, now: Date): Bucket {
  if (!due) return "later";
  const ms = due.getTime() - now.getTime();
  if (ms < 0) return "overdue";
  return ms < 7 * DAY_MS ? "week" : "later";
}

export type AssessmentStatus = "DRAFT" | "SUBMITTED";

export const ASSESSMENT_LABELS: Record<AssessmentStatus | "NONE", string> = {
  NONE: "Non commencée",
  DRAFT: "Brouillon",
  SUBMITTED: "Soumise",
};

export type MilestoneProgressInput = {
  /** Le jalon a une grille de critères → une auto-évaluation est attendue */
  hasCriteria: boolean;
  requiresDepositUrl: boolean;
  peerReviewEnabled: boolean;
  assessmentStatus: AssessmentStatus | null;
  depositCount: number;
  /** Coéquipiers (sans moi) */
  teammateIds: readonly string[];
  /** Coéquipiers que j'ai déjà évalués sur ce jalon */
  reviewedIds: readonly string[];
};

export type MilestoneProgress = {
  assessmentDone: boolean;
  depositDone: boolean;
  /** Nombre de coéquipiers restant à évaluer (0 si l'évaluation entre pairs est désactivée) */
  peerPending: number;
  done: boolean;
};

/** Ce qu'il reste à faire à l'étudiant sur un jalon */
export function milestoneProgress(i: MilestoneProgressInput): MilestoneProgress {
  const assessmentDone = !i.hasCriteria || i.assessmentStatus === "SUBMITTED";
  const depositDone = !i.requiresDepositUrl || i.depositCount > 0;
  const reviewed = new Set(i.reviewedIds);
  const peerPending = i.peerReviewEnabled ? i.teammateIds.filter((id) => !reviewed.has(id)).length : 0;
  return { assessmentDone, depositDone, peerPending, done: assessmentDone && depositDone && peerPending === 0 };
}

export type LinkStatus = "OK" | "PRIVATE" | "BROKEN" | "UNREACHABLE";

/** Statut de lien à signaler (cassé prioritaire sur privé), ou null si rien à signaler */
export function linkProblem(statuses: readonly (LinkStatus | null | undefined)[]): "BROKEN" | "PRIVATE" | null {
  if (statuses.includes("BROKEN")) return "BROKEN";
  if (statuses.includes("PRIVATE")) return "PRIVATE";
  return null;
}

/** Tri par échéance croissante, éléments sans date à la fin (tri stable) */
export function sortByDue<T extends { due: Date | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.due && b.due) return a.due.getTime() - b.due.getTime();
    if (a.due) return -1;
    if (b.due) return 1;
    return 0;
  });
}

/** Répartit les éléments dans les trois sections, chacune triée par échéance */
export function groupByBucket<T extends { due: Date | null }>(items: T[], now: Date): Record<Bucket, T[]> {
  const out: Record<Bucket, T[]> = { overdue: [], week: [], later: [] };
  for (const item of sortByDue(items)) out[bucketFor(item.due, now)].push(item);
  return out;
}

/** Extrait court d'un texte libre, sur une ligne */
export function excerpt(text: string, max = 140) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
}

export function plural(n: number, singular: string, pluralForm = `${singular}s`) {
  return `${n} ${n > 1 ? pluralForm : singular}`;
}

export type NextActionInput = {
  saeId: string;
  milestoneId: string;
  groupId: string;
  hasCriteria: boolean;
  assessmentId: string | null;
  assessmentStatus: AssessmentStatus | null;
  feedbackPublished: boolean;
  depositRequired: boolean;
  depositCount: number;
  depositProblem: "BROKEN" | "PRIVATE" | null;
  peerPending: number;
};

export type NextAction = { label: string; href: string; primary: boolean };

/** Prochaine action utile sur un jalon, dans l'ordre : s'auto-évaluer, déposer, corriger le lien, évaluer ses pairs, lire le retour */
export function nextStudentAction(i: NextActionInput): NextAction | null {
  const milestone = `/saes/${i.saeId}/milestones/${i.milestoneId}`;
  const group = `/saes/${i.saeId}/groups/${i.groupId}`;
  if (i.hasCriteria && i.assessmentStatus !== "SUBMITTED") {
    return { label: i.assessmentStatus === "DRAFT" ? "Reprendre mon brouillon" : "M'auto-évaluer", href: `${milestone}/assess`, primary: true };
  }
  if (i.depositRequired && i.depositCount === 0) return { label: "Déposer l'URL", href: group, primary: true };
  if (i.depositProblem) return { label: "Corriger le lien", href: group, primary: true };
  if (i.peerPending > 0) return { label: "Évaluer mes coéquipiers", href: milestone, primary: true };
  if (i.feedbackPublished && i.assessmentId) return { label: "Voir le retour", href: `/assessments/${i.assessmentId}`, primary: false };
  return null;
}
