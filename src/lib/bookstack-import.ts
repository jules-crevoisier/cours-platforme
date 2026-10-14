// Import BookStack → plateforme : fonctions pures (aucun accès réseau ni base), testables.
// Utilisées par `scripts/import-bookstack.ts`.
import { slugify } from "./content";

export type BsBook = { id: number; name: string; slug: string; description?: string | null; updated_at?: string };
export type BsShelf = { id: number; name: string; books: { id: number }[] };

const ARCHIVE_RE = /\b(backup|old|test|copie)(?![a-z])/i;

export type Millesime = {
  /** Titre sans l'indicateur d'année ni de sauvegarde, pour regrouper les versions d'un même cours */
  base: string;
  /** Année de début du millésime (2025 pour « 25/26 », « 2025-2026 », « (2025) »), si détectée */
  year: number | null;
  /** Sauvegarde / ancienne version / test : jamais importée par défaut */
  archived: boolean;
};

const toYear = (s: string) => (s.length === 2 ? 2000 + Number(s) : Number(s));

/** « [25/26] WR506D », « WR215 - Hébergement (2025-2026) », « SAE107 (BACKUP2024) » → base + millésime */
export function parseMillesime(title: string): Millesime {
  let year: number | null = null;
  let rest = title;
  const patterns: RegExp[] = [
    /[[(]\s*(\d{2}|\d{4})\s*[/\-–]\s*(?:\d{2}|\d{4})\s*[\])]/, // [25/26] (2025-2026)
    /[[(]\s*(\d{4})\s*[\])]/, // (2025)
    /\b(?:BACKUP|OLD)\s*(\d{4})\b/i, // BACKUP 2023, BACKUP2024
    /\bversion\s+(\d{4})\b/i,
    /\s-\s(\d{4})\s*$/, // « - 2025 » en fin de titre
  ];
  for (const re of patterns) {
    const m = rest.match(re);
    if (m) {
      year = toYear(m[1]);
      rest = rest.replace(re, " ");
      break;
    }
  }
  const archived = ARCHIVE_RE.test(title);
  const base = rest
    .replace(/\b(?:BACKUP|OLD)\b/gi, " ")
    .replace(/[[\]()]/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s\-–|:]+|[\s\-–|:]+$/g, "")
    .trim();
  return { base: base || title.trim(), year, archived };
}

export type CourseCandidate = BsBook & Millesime & { shelves: string[] };
export type SkipReason = "archived" | "older-version";

/** Pour chaque cours (même base), garde la version la plus récente non archivée ; le reste va dans `skipped`. */
export function selectCurrentVersions(
  books: CourseCandidate[],
  opts: { includeArchived?: boolean } = {},
): { keep: CourseCandidate[]; skipped: { book: CourseCandidate; reason: SkipReason }[] } {
  const skipped: { book: CourseCandidate; reason: SkipReason }[] = [];
  const groups = new Map<string, CourseCandidate[]>();
  for (const b of books) {
    if (b.archived && !opts.includeArchived) {
      skipped.push({ book: b, reason: "archived" });
      continue;
    }
    const key = slugify(b.base);
    groups.set(key, [...(groups.get(key) ?? []), b]);
  }
  const keep: CourseCandidate[] = [];
  for (const group of groups.values()) {
    const sorted = [...group].sort(
      (a, b) =>
        (b.year ?? 0) - (a.year ?? 0) ||
        (b.updated_at ?? "").localeCompare(a.updated_at ?? "") ||
        b.id - a.id,
    );
    keep.push(sorted[0]);
    for (const old of sorted.slice(1)) skipped.push({ book: old, reason: "older-version" });
  }
  return { keep, skipped };
}

export type SaeHint = { code: string | null; semester: number | null } | null;

/**
 * Un livre est une SAÉ s'il est sur une étagère « SAE Semestre N » ou si son titre contient
 * un code SAÉ (SAE302, WS301D, WSA501D, WS202…).
 */
export function detectSae(book: { name: string; shelves: string[] }): SaeHint {
  const shelfSem = book.shelves.map((s) => s.match(/^SAE\s+Semestre\s+(\d)/i)).find(Boolean);
  const code =
    book.name.match(/\b(SAE\s?\d{3}|WSA?\d{3}[A-Z]?)\b/i)?.[1]?.replace(/\s+/g, "").toUpperCase() ?? null;
  if (!shelfSem && !code) return null;
  let semester: number | null = null;
  if (shelfSem) semester = Number(shelfSem[1]);
  else {
    const d = code!.match(/(\d)\d{2}/);
    semester = d ? Number(d[1]) : null;
  }
  return { code, semester };
}

const NON_MILESTONE_CHAPTER = /^(organisation|annexes?|ressources?|pr[ée]sentation|introduction)\b/i;

/** Les chapitres « SEMAINE 01 », « Phase 2 »… d'un livre SAÉ deviennent des jalons ; ORGANISATION/ANNEXES non. */
export function chapterIsMilestone(chapterTitle: string): boolean {
  return !NON_MILESTONE_CHAPTER.test(chapterTitle.trim());
}

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", laquo: "«", raquo: "»",
  rsquo: "’", lsquo: "‘", ndash: "–", mdash: "—", eacute: "é", egrave: "è", agrave: "à",
};
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });

/** Conversion HTML BookStack → Markdown (suffisante pour du contenu de cours ; le reste est aplati en texte). */
export function htmlToMarkdown(html: string): string {
  let s = html.replace(/\r/g, "").replace(/<(script|style)[\s\S]*?<\/\1>/gi, "");
  s = s.replace(
    /<pre[^>]*>\s*(?:<code[^>]*>)?([\s\S]*?)(?:<\/code>)?\s*<\/pre>/gi,
    (_, c: string) => "\n\n```\n" + decode(c.replace(/<[^>]+>/g, "")).replace(/\n+$/, "") + "\n```\n\n",
  );
  s = s.replace(
    /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi,
    (_, n: string, c: string) => `\n\n${"#".repeat(Number(n))} ${c.replace(/<[^>]+>/g, "").trim()}\n\n`,
  );
  s = s.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, "**$2**").replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, "*$2*");
  s = s.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`");
  s = s.replace(/<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, h: string, t: string) => {
    const text = t.replace(/<[^>]+>/g, "").trim();
    return /^(https?:|mailto:)/i.test(h) && text ? `[${text}](${h})` : text;
  });
  s = s.replace(/<img\s[^>]*>/gi, (tag) => {
    const src = tag.match(/src="([^"]*)"/i)?.[1] ?? "";
    const alt = tag.match(/alt="([^"]*)"/i)?.[1] ?? "";
    return /^https?:/i.test(src) ? `![${alt}](${src})` : "";
  });
  s = s.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, c: string) => `\n- ${c.replace(/<\/?(ul|ol)[^>]*>/gi, "").replace(/\s+/g, " ").trim()}`);
  s = s.replace(/<\/?(ul|ol)[^>]*>/gi, "\n").replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(
    /<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi,
    (_, c: string) => "\n\n" + c.replace(/<[^>]+>/g, "").trim().replace(/^/gm, "> ") + "\n\n",
  );
  s = s.replace(/<\/(p|div|tr|table)>/gi, "\n\n").replace(/<\/t[dh]>/gi, " | ");
  s = decode(s.replace(/<[^>]+>/g, ""));
  return s.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Slug unique : `base`, puis `base-2`, `base-3`… */
export function uniqueSlug(base: string, taken: Set<string>): string {
  const root = slugify(base) || "cours";
  let slug = root;
  for (let i = 2; taken.has(slug); i++) slug = `${root}-${i}`;
  taken.add(slug);
  return slug;
}
