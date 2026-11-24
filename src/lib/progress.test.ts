import { describe, expect, it } from "vitest";
import { courseProgress, pageToResume } from "./progress";

const order = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];

describe("courseProgress", () => {
  it("compte les pages lues du cours seulement", () => {
    expect(courseProgress(["a", "b", "c", "d"], new Set(["a", "c", "supprimée"]))).toEqual({
      total: 4,
      read: 2,
      percent: 50,
      done: false,
    });
  });
  it("cours vide : 0 %, jamais terminé", () => {
    expect(courseProgress([], new Set())).toEqual({ total: 0, read: 0, percent: 0, done: false });
  });
  it("tout lu : terminé", () => {
    expect(courseProgress(["a", "b"], new Set(["a", "b"])).done).toBe(true);
  });
});

describe("pageToResume", () => {
  it("rien lu : la première page", () => {
    expect(pageToResume(order, new Set())?.id).toBe("a");
  });
  it("reprend après la dernière page lue", () => {
    expect(pageToResume(order, new Set(["a", "b"]), "b")?.id).toBe("c");
  });
  it("saute les pages déjà lues", () => {
    expect(pageToResume(order, new Set(["a", "b", "c"]), "b")?.id).toBe("d");
  });
  it("revient au début quand la fin est lue mais pas le début", () => {
    expect(pageToResume(order, new Set(["c", "d"]), "d")?.id).toBe("a");
  });
  it("tout lu : null", () => {
    expect(pageToResume(order, new Set(["a", "b", "c", "d"]), "d")).toBeNull();
  });
  it("dernière page lue inconnue : début du cours", () => {
    expect(pageToResume(order, new Set(), "zzz")?.id).toBe("a");
  });
});
