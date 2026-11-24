// Collage dans l'éditeur : détecter du Markdown brut (copié depuis un fichier .md, VS Code, GitHub « raw »…)
// pour le convertir en blocs au lieu de le coller comme un bloc de code ou du texte plat.

const MARKDOWN_SIGNS = [
  /^ {0,3}#{1,6}\s+\S/m, // titres
  /^ {0,3}```/m, // blocs de code
  /^ {0,3}\|.+\|\s*$\n^ {0,3}\|?\s*:?-{3,}/m, // tableaux
  /^ {0,3}(?:[-*+]|\d+\.)\s+\S/m, // listes
  /^ {0,3}>\s+\S/m, // citations
  /\*\*[^*\n]+\*\*/, // gras
];

/** Au moins deux signes de Markdown (ou un titre/bloc de code/tableau) : on considère le texte comme du Markdown */
export function looksLikeMarkdown(text: string): boolean {
  if (!text || text.length < 3) return false;
  const hits = MARKDOWN_SIGNS.filter((re) => re.test(text)).length;
  return hits >= 2 || /^ {0,3}(?:#{1,6}\s+\S|```)/m.test(text) || MARKDOWN_SIGNS[2].test(text);
}

/** Le HTML du presse-papiers est « riche » s'il contient de vrais éléments de structure (titres, listes, tableaux…) */
export function hasStructuredHtml(html: string): boolean {
  return /<(h[1-6]|table|ul|ol|blockquote|figure)\b/i.test(html);
}

/**
 * Coller comme Markdown quand le texte en est, sauf si le presse-papiers porte déjà du HTML structuré
 * (copie depuis une page rendue : BlockNote le gère très bien).
 */
export function shouldPasteAsMarkdown(text: string, html: string): boolean {
  return looksLikeMarkdown(text) && !hasStructuredHtml(html);
}
