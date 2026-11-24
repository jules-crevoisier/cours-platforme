// Progression de lecture d'un cours (pur, testable) : pages lues, pourcentage, page à reprendre.

export type CourseProgress = { total: number; read: number; percent: number; done: boolean };

/** Compte uniquement les pages du cours : une page lue puis supprimée ne gonfle pas le total */
export function courseProgress(pageIds: string[], readIds: ReadonlySet<string>): CourseProgress {
  const total = pageIds.length;
  const read = pageIds.filter((id) => readIds.has(id)).length;
  return { total, read, percent: total === 0 ? 0 : Math.round((read / total) * 100), done: total > 0 && read === total };
}

/**
 * Page à reprendre : la première page non lue après la dernière page lue (ordre de lecture),
 * sinon la première page non lue du cours. `null` quand tout est lu ou que le cours est vide.
 */
export function pageToResume<T extends { id: string }>(
  order: T[],
  readIds: ReadonlySet<string>,
  lastReadId?: string | null,
): T | null {
  const start = lastReadId ? order.findIndex((p) => p.id === lastReadId) + 1 : 0;
  return order.slice(start).find((p) => !readIds.has(p.id)) ?? order.find((p) => !readIds.has(p.id)) ?? null;
}
