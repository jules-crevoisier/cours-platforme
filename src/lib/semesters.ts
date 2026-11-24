export const SEMESTERS = [
  { value: "S1", label: "S1" },
  { value: "S2", label: "S2" },
  { value: "S3", label: "S3" },
  { value: "S4", label: "S4" },
  { value: "S5", label: "S5" },
  { value: "S6", label: "S6" },
  { value: "SAE", label: "SAÉ" },
  { value: "AUTRE", label: "Autre" },
] as const;

export type Semester = (typeof SEMESTERS)[number]["value"];

export const SEMESTER_VALUES = SEMESTERS.map((s) => s.value) as [Semester, ...Semester[]];

export function parseSemester(v: unknown): Semester | null {
  return SEMESTER_VALUES.find((s) => s === v) ?? null;
}

export function semesterLabel(v: string | null | undefined): string | null {
  return SEMESTERS.find((s) => s.value === v)?.label ?? null;
}
