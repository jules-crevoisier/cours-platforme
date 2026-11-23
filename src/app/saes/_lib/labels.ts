/** Libellé court d'une SAÉ pour le fil d'Ariane : son code, sinon le début de son titre */
export function saeCrumb(sae: { code: string | null; title: string }): string {
  if (sae.code) return sae.code;
  return sae.title.length > 32 ? `${sae.title.slice(0, 30).trimEnd()}…` : sae.title;
}
