import { describe, expect, it } from "vitest";
import {
  chapterIsMilestone,
  detectSae,
  htmlToMarkdown,
  parseMillesime,
  selectCurrentVersions,
  uniqueSlug,
  type CourseCandidate,
} from "./bookstack-import";

const cand = (id: number, name: string, updated_at = "2025-01-01"): CourseCandidate => ({
  id,
  name,
  slug: String(id),
  updated_at,
  shelves: [],
  ...parseMillesime(name),
});

describe("parseMillesime", () => {
  it("lit [25/26] et (2025-2026)", () => {
    expect(parseMillesime("[25/26] WR506D | Développement back avancé")).toMatchObject({
      base: "WR506D | Développement back avancé",
      year: 2025,
      archived: false,
    });
    expect(parseMillesime("WR215 - Hébergement (2025-2026)")).toMatchObject({ base: "WR215 - Hébergement", year: 2025 });
  });
  it("détecte les sauvegardes", () => {
    expect(parseMillesime("SAE107 (BACKUP2024)")).toMatchObject({ base: "SAE107", year: 2024, archived: true });
    expect(parseMillesime("OLD WS302a | Produire des contenus BACKUP 2022").archived).toBe(true);
    expect(parseMillesime("Test").archived).toBe(true);
  });
  it("laisse un titre sans millésime intact", () => {
    expect(parseMillesime("WR112 - Intégration")).toEqual({ base: "WR112 - Intégration", year: null, archived: false });
  });
});

describe("selectCurrentVersions", () => {
  it("garde la version la plus récente et écarte archives et anciennes versions", () => {
    const books = [cand(1, "[25/26] WR506D"), cand(2, "[26/27] WR506D"), cand(3, "WR506D BACKUP 2023"), cand(4, "WR112 - Intégration")];
    const { keep, skipped } = selectCurrentVersions(books);
    expect(keep.map((b) => b.id).sort()).toEqual([2, 4]);
    expect(skipped.map((s) => [s.book.id, s.reason]).sort()).toEqual([
      [1, "older-version"],
      [3, "archived"],
    ]);
  });
  it("includeArchived garde les sauvegardes", () => {
    expect(selectCurrentVersions([cand(1, "SAE107 (BACKUP2024)")], { includeArchived: true }).keep).toHaveLength(1);
  });
});

describe("detectSae", () => {
  it("étagère SAE Semestre N", () => {
    expect(detectSae({ name: "Trame", shelves: ["SAE Semestre 1"] })).toEqual({ code: null, semester: 1 });
  });
  it("code dans le titre", () => {
    expect(detectSae({ name: "SAE302", shelves: [] })).toEqual({ code: "SAE302", semester: 3 });
    expect(detectSae({ name: "WSA501D Jeu d'arcade", shelves: [] })).toEqual({ code: "WSA501D", semester: 5 });
  });
  it("cours ordinaire → null", () => {
    expect(detectSae({ name: "WR112 - Intégration", shelves: ["BUT1 - Semestre 1"] })).toBeNull();
  });
});

describe("chapterIsMilestone", () => {
  it("semaines oui, organisation/annexes non", () => {
    expect(chapterIsMilestone("SEMAINE 01")).toBe(true);
    expect(chapterIsMilestone("ORGANISATION")).toBe(false);
    expect(chapterIsMilestone("Annexes")).toBe(false);
  });
});

describe("htmlToMarkdown", () => {
  it("titres, listes, liens, code", () => {
    const md = htmlToMarkdown(
      '<h2>Objectif</h2><p>Voir <a href="https://x.fr">le site</a> &amp; <strong>noter</strong></p><ul><li>un</li><li>deux</li></ul><pre><code>npm i</code></pre>',
    );
    expect(md).toContain("## Objectif");
    expect(md).toContain("[le site](https://x.fr) & **noter**");
    expect(md).toContain("- un\n- deux");
    expect(md).toContain("```\nnpm i\n```");
  });
  it("ne garde ni scripts ni liens javascript:", () => {
    expect(htmlToMarkdown('<script>alert(1)</script><a href="javascript:alert(1)">clic</a>')).toBe("clic");
  });
});

describe("uniqueSlug", () => {
  it("suffixe en cas de collision", () => {
    const taken = new Set(["wr112"]);
    expect(uniqueSlug("WR112", taken)).toBe("wr112-2");
    expect(uniqueSlug("WR112", taken)).toBe("wr112-3");
  });
});
