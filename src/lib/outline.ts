// Plan d'une page (pur, testable) : liste des titres avec leur niveau, du plus haut niveau présent.

export type OutlineItem = { index: number; text: string; level: number };

/** Garde les titres non vides ; le niveau est ramené à 0 (plus haut niveau présent), 1 (sous-titre) ou 2 */
export function buildOutline(headings: { text: string; level: number }[]): OutlineItem[] {
  const items = headings
    .map((h, index) => ({ index, text: h.text.replace(/\s+/g, " ").trim(), level: Number.isFinite(h.level) ? h.level : 1 }))
    .filter((h) => h.text.length > 0);
  if (items.length === 0) return [];
  const top = Math.min(...items.map((h) => h.level));
  return items.map((h) => ({ ...h, level: Math.min(2, Math.max(0, h.level - top)) }));
}
