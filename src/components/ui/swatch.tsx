import { cx } from "./cx";

/**
 * Swatch — carré de couleur avec initiales, stable pour un même identifiant :
 * distingue un cours ou une SAÉ d'un coup d'œil dans les listes. Décoratif (le titre est écrit à côté).
 *
 *   <Swatch seed={course.id} text={course.title} />
 *   <Swatch seed={sae.id} text={sae.code ?? sae.title} size="lg" />
 */
const COLORS = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)", "var(--accent)"];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** « SAÉ 2.03 » → « 2.03 » ; « Développement web » → « DW » */
function initials(text: string) {
  const code = /\d+(?:\.\d+)?/.exec(text);
  if (code && code[0].length <= 4) return code[0];
  const words = text.trim().split(/\s+/).filter((w) => /^[\p{L}\d]/u.test(w) && w.length > 2);
  const letters = (words[0]?.[0] ?? text[0] ?? "?") + (words[1]?.[0] ?? "");
  return letters.toUpperCase();
}

const SIZE = { md: "size-10 text-sm", lg: "size-14 text-base" } as const;

export function Swatch({ seed, text, size = "md", className }: { seed: string; text: string; size?: keyof typeof SIZE; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx("flex shrink-0 items-center justify-center font-bold tracking-tight text-bg [font-stretch:115%]", SIZE[size], className)}
      style={{ background: COLORS[hash(seed) % COLORS.length] }}
    >
      {initials(text)}
    </span>
  );
}
