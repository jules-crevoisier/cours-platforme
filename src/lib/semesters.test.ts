import { describe, expect, it } from "vitest";
import { parseSemester, semesterLabel } from "./semesters";

describe("semesters", () => {
  it("accepte les valeurs connues", () => {
    expect(parseSemester("S3")).toBe("S3");
    expect(parseSemester("SAE")).toBe("SAE");
  });
  it("rejette le reste", () => {
    expect(parseSemester("S9")).toBeNull();
    expect(parseSemester("")).toBeNull();
    expect(parseSemester(undefined)).toBeNull();
  });
  it("donne un libellé", () => {
    expect(semesterLabel("SAE")).toBe("SAÉ");
    expect(semesterLabel(null)).toBeNull();
  });
});
