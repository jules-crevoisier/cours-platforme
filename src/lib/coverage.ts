// Couverture du référentiel par les SAÉ et complétude d'une SAÉ. Fonctions pures (testables, sans accès base).

export type LearningRef = { id: string; code: string; label: string; level: number; competenceCode: string };
export type CoverageSae = { id: string; code: string | null; title: string; semester: number | null };
/** Un critère de jalon relié à un AC */
export type CoverageLink = { learningId: string; saeId: string };

export type CoverageRow = { learning: LearningRef; saes: CoverageSae[] };
export type Coverage = {
  rows: CoverageRow[];
  /** SAÉ qui couvrent au moins un AC, triées par semestre puis code */
  columns: CoverageSae[];
  covered: number;
  total: number;
  uncovered: LearningRef[];
};

export function buildCoverage(learnings: LearningRef[], saes: CoverageSae[], links: CoverageLink[]): Coverage {
  const saeById = new Map(saes.map((s) => [s.id, s]));
  const byLearning = new Map<string, Set<string>>();
  for (const l of links) {
    if (!saeById.has(l.saeId)) continue;
    byLearning.set(l.learningId, (byLearning.get(l.learningId) ?? new Set()).add(l.saeId));
  }
  const used = new Set<string>();
  const bySemesterThenCode = (a: CoverageSae, b: CoverageSae) =>
    (a.semester ?? 99) - (b.semester ?? 99) || (a.code ?? a.title).localeCompare(b.code ?? b.title, "fr");

  const rows: CoverageRow[] = learnings.map((learning) => {
    const ids = byLearning.get(learning.id) ?? new Set<string>();
    ids.forEach((id) => used.add(id));
    return { learning, saes: [...ids].map((id) => saeById.get(id)!).sort(bySemesterThenCode) };
  });
  const uncovered = rows.filter((r) => r.saes.length === 0).map((r) => r.learning);
  return {
    rows,
    columns: [...used].map((id) => saeById.get(id)!).sort(bySemesterThenCode),
    covered: rows.length - uncovered.length,
    total: rows.length,
    uncovered,
  };
}

export type SaeGap = "jalons" | "dates" | "ac";
export const SAE_GAP_LABELS: Record<SaeGap, string> = {
  jalons: "Sans jalon",
  dates: "Sans dates",
  ac: "Sans AC visé",
};

/** Ce qu'il reste à renseigner sur une SAÉ (typiquement après un import). */
export function saeGaps(sae: {
  startsAt: Date | null;
  endsAt: Date | null;
  milestoneCount: number;
  linkedLearningCount: number;
}): SaeGap[] {
  const gaps: SaeGap[] = [];
  if (sae.milestoneCount === 0) gaps.push("jalons");
  if (!sae.startsAt && !sae.endsAt) gaps.push("dates");
  if (sae.linkedLearningCount === 0) gaps.push("ac");
  return gaps;
}
