import { describe, expect, it } from "vitest";
import { bucketFor, excerpt, groupByBucket, linkProblem, milestoneProgress, nextStudentAction, plural, sortByDue } from "./todo";

const now = new Date("2026-10-13T08:00:00Z");
const inDays = (d: number) => new Date(now.getTime() + d * 86_400_000);

describe("bucketFor", () => {
  it("répartit par échéance", () => {
    expect(bucketFor(inDays(-0.01), now)).toBe("overdue");
    expect(bucketFor(now, now)).toBe("week");
    expect(bucketFor(inDays(6.9), now)).toBe("week");
    expect(bucketFor(inDays(7), now)).toBe("later");
    expect(bucketFor(null, now)).toBe("later");
  });
});

describe("milestoneProgress", () => {
  const base = {
    hasCriteria: true,
    requiresDepositUrl: false,
    peerReviewEnabled: false,
    assessmentStatus: null,
    depositCount: 0,
    teammateIds: ["b", "c"],
    reviewedIds: [],
  } as const;

  it("auto-évaluation attendue seulement si le jalon a des critères", () => {
    expect(milestoneProgress({ ...base }).assessmentDone).toBe(false);
    expect(milestoneProgress({ ...base, assessmentStatus: "DRAFT" }).assessmentDone).toBe(false);
    expect(milestoneProgress({ ...base, assessmentStatus: "SUBMITTED" }).done).toBe(true);
    expect(milestoneProgress({ ...base, hasCriteria: false }).done).toBe(true);
  });

  it("URL de dépôt exigée", () => {
    const p = milestoneProgress({ ...base, assessmentStatus: "SUBMITTED", requiresDepositUrl: true });
    expect(p.depositDone).toBe(false);
    expect(p.done).toBe(false);
    expect(milestoneProgress({ ...base, assessmentStatus: "SUBMITTED", requiresDepositUrl: true, depositCount: 1 }).done).toBe(true);
  });

  it("évaluation entre pairs : compte les coéquipiers restants", () => {
    const p = milestoneProgress({ ...base, assessmentStatus: "SUBMITTED", peerReviewEnabled: true, reviewedIds: ["b"] });
    expect(p.peerPending).toBe(1);
    expect(p.done).toBe(false);
    expect(
      milestoneProgress({ ...base, assessmentStatus: "SUBMITTED", peerReviewEnabled: true, reviewedIds: ["b", "c", "x"] }).done,
    ).toBe(true);
    // Seul dans son groupe : rien à évaluer
    expect(milestoneProgress({ ...base, hasCriteria: false, peerReviewEnabled: true, teammateIds: [] }).done).toBe(true);
    // Désactivée : ignorée
    expect(milestoneProgress({ ...base, hasCriteria: false }).peerPending).toBe(0);
  });
});

describe("linkProblem", () => {
  it("cassé prioritaire sur privé, rien sinon", () => {
    expect(linkProblem(["OK", "PRIVATE", "BROKEN"])).toBe("BROKEN");
    expect(linkProblem(["OK", "PRIVATE", null])).toBe("PRIVATE");
    expect(linkProblem(["OK", "UNREACHABLE", null])).toBeNull();
    expect(linkProblem([])).toBeNull();
  });
});

describe("tri et regroupement", () => {
  it("trie par échéance, sans date à la fin", () => {
    const items = [{ id: "n", due: null }, { id: "b", due: inDays(3) }, { id: "a", due: inDays(1) }];
    expect(sortByDue(items).map((i) => i.id)).toEqual(["a", "b", "n"]);
  });

  it("regroupe par section", () => {
    const items = [
      { id: "late", due: inDays(-2) },
      { id: "soon", due: inDays(2) },
      { id: "far", due: inDays(20) },
      { id: "none", due: null },
    ];
    const g = groupByBucket(items, now);
    expect(g.overdue.map((i) => i.id)).toEqual(["late"]);
    expect(g.week.map((i) => i.id)).toEqual(["soon"]);
    expect(g.later.map((i) => i.id)).toEqual(["far", "none"]);
  });
});

describe("textes", () => {
  it("excerpt aplatit et coupe", () => {
    expect(excerpt("  a\n\nb  ")).toBe("a b");
    expect(excerpt("x".repeat(200), 10)).toBe("xxxxxxxxx…");
  });
  it("plural", () => {
    expect(plural(1, "jalon")).toBe("1 jalon");
    expect(plural(3, "jalon")).toBe("3 jalons");
    expect(plural(2, "nouveau", "nouveaux")).toBe("2 nouveaux");
  });
});

describe("nextStudentAction", () => {
  const base = {
    saeId: "s",
    milestoneId: "m",
    groupId: "g",
    hasCriteria: true,
    assessmentId: null,
    assessmentStatus: null,
    feedbackPublished: false,
    depositRequired: true,
    depositCount: 0,
    depositProblem: null,
    peerPending: 2,
  } as const;

  it("priorise l'auto-évaluation, puis le dépôt, le lien, les pairs, le retour", () => {
    expect(nextStudentAction({ ...base })).toEqual({ label: "M'auto-évaluer", href: "/saes/s/milestones/m/assess", primary: true });
    expect(nextStudentAction({ ...base, assessmentStatus: "DRAFT" })?.label).toBe("Reprendre mon brouillon");
    const submitted = { ...base, assessmentStatus: "SUBMITTED" as const, assessmentId: "a" };
    expect(nextStudentAction(submitted)).toEqual({ label: "Déposer l'URL", href: "/saes/s/groups/g", primary: true });
    expect(nextStudentAction({ ...submitted, depositCount: 1, depositProblem: "PRIVATE" })?.label).toBe("Corriger le lien");
    expect(nextStudentAction({ ...submitted, depositCount: 1 })).toEqual({
      label: "Évaluer mes coéquipiers",
      href: "/saes/s/milestones/m",
      primary: true,
    });
    expect(nextStudentAction({ ...submitted, depositCount: 1, peerPending: 0, feedbackPublished: true })).toEqual({
      label: "Voir le retour",
      href: "/assessments/a",
      primary: false,
    });
    expect(nextStudentAction({ ...submitted, depositCount: 1, peerPending: 0 })).toBeNull();
  });

  it("sans critères, pas d'auto-évaluation demandée", () => {
    expect(nextStudentAction({ ...base, hasCriteria: false, depositRequired: false, peerPending: 0 })).toBeNull();
  });
});
