import { describe, expect, it } from "vitest";
import { buildCoverage, saeGaps, type CoverageSae, type LearningRef } from "./coverage";

const L = (id: string, code: string): LearningRef => ({ id, code, label: code, level: 1, competenceCode: "C1" });
const S = (id: string, code: string, semester: number | null): CoverageSae => ({ id, code, title: code, semester });

describe("buildCoverage", () => {
  const learnings = [L("a", "AC11.01"), L("b", "AC11.02"), L("c", "AC12.01")];
  const saes = [S("s2", "SAE201", 2), S("s1", "SAE101", 1), S("s9", "SAE999", 1)];

  it("indique pour chaque AC les SAÉ qui le visent, triées par semestre", () => {
    const cov = buildCoverage(learnings, saes, [
      { learningId: "a", saeId: "s2" },
      { learningId: "a", saeId: "s1" },
      { learningId: "b", saeId: "s1" },
    ]);
    expect(cov.rows[0].saes.map((s) => s.code)).toEqual(["SAE101", "SAE201"]);
    expect(cov.covered).toBe(2);
    expect(cov.total).toBe(3);
    expect(cov.uncovered.map((l) => l.code)).toEqual(["AC12.01"]);
  });

  it("ne garde en colonnes que les SAÉ qui couvrent un AC", () => {
    const cov = buildCoverage(learnings, saes, [{ learningId: "a", saeId: "s1" }]);
    expect(cov.columns.map((s) => s.code)).toEqual(["SAE101"]);
  });

  it("ignore les liens vers une SAÉ inconnue et ne compte un AC qu'une fois par SAÉ", () => {
    const cov = buildCoverage(learnings, saes, [
      { learningId: "a", saeId: "s1" },
      { learningId: "a", saeId: "s1" },
      { learningId: "a", saeId: "ghost" },
    ]);
    expect(cov.rows[0].saes).toHaveLength(1);
  });

  it("référentiel vide : couverture à 0 sur 0", () => {
    expect(buildCoverage([], saes, [])).toMatchObject({ covered: 0, total: 0, uncovered: [], columns: [] });
  });
});

describe("saeGaps", () => {
  const base = { startsAt: null, endsAt: null, milestoneCount: 0, linkedLearningCount: 0 };
  it("liste tout ce qui manque", () => {
    expect(saeGaps(base)).toEqual(["jalons", "dates", "ac"]);
  });
  it("SAÉ complète → aucun manque", () => {
    expect(saeGaps({ startsAt: new Date(), endsAt: null, milestoneCount: 2, linkedLearningCount: 3 })).toEqual([]);
  });
  it("une seule date suffit", () => {
    expect(saeGaps({ ...base, endsAt: new Date(), milestoneCount: 1, linkedLearningCount: 1 })).toEqual([]);
  });
});
