import { describe, expect, it } from "vitest";
import { parsePage } from "./pagination";

describe("parsePage", () => {
  it("page 1 par défaut et pour toute valeur invalide", () => {
    expect(parsePage(undefined, 100).page).toBe(1);
    expect(parsePage("abc", 100).page).toBe(1);
    expect(parsePage("-3", 100).page).toBe(1);
    expect(parsePage("0", 100).page).toBe(1);
  });
  it("borne à la dernière page", () => {
    expect(parsePage("99", 50, 24)).toMatchObject({ page: 3, lastPage: 3, skip: 48 });
  });
  it("aucun résultat : une seule page", () => {
    expect(parsePage("5", 0)).toMatchObject({ page: 1, lastPage: 1, skip: 0 });
  });
  it("accepte un tableau (paramètre répété)", () => {
    expect(parsePage(["2", "3"], 100, 24).page).toBe(2);
  });
});
