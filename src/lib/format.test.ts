import { describe, expect, it } from "vitest";
import { deadline, timeAgo } from "./format";

describe("deadline", () => {
  const now = new Date("2026-10-13T08:00:00Z"); // mardi 10h à Paris
  it("dans n jours (calendaires de Paris), puis la date", () => {
    expect(deadline(new Date("2026-10-16T06:00:00Z"), now)).toEqual({ label: "Dans 3 jours", tone: "soon" }); // 70 h
    expect(deadline(new Date("2026-10-16T16:00:00Z"), now)).toEqual({ label: "Dans 3 jours", tone: "later" }); // 80 h
    expect(deadline(new Date("2026-10-23T16:00:00Z"), now)).toEqual({ label: "23 oct.", tone: "later" });
  });
  it("aujourd'hui, demain, en retard, fait", () => {
    expect(deadline(new Date("2026-10-13T16:00:00Z"), now).label).toBe("Aujourd'hui");
    expect(deadline(new Date("2026-10-14T16:00:00Z"), now).label).toBe("Demain");
    expect(deadline(new Date("2026-10-12T16:00:00Z"), now)).toEqual({ label: "En retard", tone: "overdue" });
    expect(deadline(new Date("2026-10-12T16:00:00Z"), now, true).tone).toBe("done");
  });
  it("gère minuit à Paris (UTC+2)", () => {
    // 23h30 UTC le 13 = 1h30 le 14 à Paris → « Demain »
    expect(deadline(new Date("2026-10-13T23:30:00Z"), now).label).toBe("Demain");
  });
});

describe("timeAgo", () => {
  it("formats courts", () => {
    const now = new Date("2026-10-13T08:00:00Z");
    expect(timeAgo(new Date("2026-10-13T07:57:00Z"), now)).toBe("il y a 3 min");
    expect(timeAgo(new Date("2026-10-11T08:00:00Z"), now)).toBe("il y a 2 j");
  });
});
