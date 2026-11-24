import { describe, expect, it } from "vitest";
import { buildOutline } from "./outline";

describe("buildOutline", () => {
  it("ramène le plus haut niveau présent à 0", () => {
    expect(buildOutline([{ text: "A", level: 2 }, { text: "B", level: 3 }, { text: "C", level: 2 }]).map((i) => i.level)).toEqual([0, 1, 0]);
  });
  it("ignore les titres vides en gardant l'index d'origine", () => {
    expect(buildOutline([{ text: "  ", level: 1 }, { text: "Suite\n  du titre", level: 1 }])).toEqual([{ index: 1, text: "Suite du titre", level: 0 }]);
  });
  it("plafonne la profondeur à 2", () => {
    expect(buildOutline([{ text: "A", level: 1 }, { text: "B", level: 5 }])[1].level).toBe(2);
  });
  it("aucun titre : liste vide", () => {
    expect(buildOutline([])).toEqual([]);
  });
});
