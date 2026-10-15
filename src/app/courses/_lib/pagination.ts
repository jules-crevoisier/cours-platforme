export const COURSES_PAGE_SIZE = 24;

/** `?page=` brut → numéro de page valide (1..lastPage) ; toute valeur invalide donne 1. */
export function parsePage(raw: string | string[] | undefined, total: number, size = COURSES_PAGE_SIZE) {
  const lastPage = Math.max(1, Math.ceil(total / size));
  const n = Number.parseInt(Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? ""), 10);
  const page = Number.isFinite(n) ? Math.min(Math.max(n, 1), lastPage) : 1;
  return { page, lastPage, skip: (page - 1) * size, take: size };
}
