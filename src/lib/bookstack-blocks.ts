// Contenu « à la BookStack » dans l'éditeur : encadrés (callouts) et intégrations.
// Fonctions pures sur le JSON des blocs BlockNote (aucun DOM) : testables et utilisables partout.
//
// Représentation Markdown d'un encadré (colonne `markdown` : recherche, portabilité, import BookStack) :
// la syntaxe « alerte » de GitHub, reconnue au chargement et au collage.
//   > [!INFO]
//   > Texte de l'encadré
import { toEmbed } from "./embeds";

export const CALLOUT_TYPES = ["info", "success", "warning", "danger"] as const;
export type CalloutType = (typeof CALLOUT_TYPES)[number];

export const CALLOUT_LABELS: Record<CalloutType, string> = {
  info: "Information",
  success: "Succès",
  warning: "Avertissement",
  danger: "Danger",
};

/** Alias GitHub (NOTE, TIP, CAUTION…) ramenés aux quatre types d'encadrés de BookStack */
const ALIASES: Record<string, CalloutType> = {
  info: "info",
  note: "info",
  important: "info",
  success: "success",
  tip: "success",
  warning: "warning",
  caution: "danger",
  danger: "danger",
};

const MARKER_RE = /^\s*\[!(info|note|important|success|tip|warning|caution|danger)\][ \t]*\n?/i;

export function isCalloutType(v: unknown): v is CalloutType {
  return typeof v === "string" && (CALLOUT_TYPES as readonly string[]).includes(v);
}

/** Classe HTML BookStack (`<p class="callout warning">`) → type d'encadré */
export function calloutTypeFromClass(className: string): CalloutType | undefined {
  const classes = className.split(/\s+/);
  if (!classes.includes("callout")) return undefined;
  return CALLOUT_TYPES.find((t) => classes.includes(t)) ?? "info";
}

export const calloutMarker = (type: CalloutType) => `[!${type.toUpperCase()}]`;

type Inline = { type: string; text?: string; href?: string; content?: unknown; styles?: Record<string, unknown> };
type AnyBlock = {
  id?: string;
  type?: string;
  props?: Record<string, unknown>;
  content?: unknown;
  children?: AnyBlock[];
};

const asInline = (content: unknown): Inline[] | null => (Array.isArray(content) ? (content as Inline[]) : null);

/** Texte visible d'un contenu en ligne (liens compris) */
function inlineText(content: Inline[]): string {
  return content
    .map((c) => (c.type === "text" ? (c.text ?? "") : c.type === "link" ? inlineText(asInline(c.content) ?? []) : ""))
    .join("");
}

/** « > [!WARNING] … » (bloc citation) → encadré ; le marqueur est retiré du texte */
function quoteToCallout(block: AnyBlock): AnyBlock | null {
  const content = asInline(block.content);
  const first = content?.[0];
  if (!content || first?.type !== "text" || typeof first.text !== "string") return null;
  const m = first.text.match(MARKER_RE);
  if (!m) return null;
  const rest = first.text.slice(m[0].length);
  // Le lecteur Markdown de BlockNote garde l'espace qui suit « > » sur chaque ligne : on la retire
  const next = (rest ? [{ ...first, text: rest }, ...content.slice(1)] : content.slice(1)).map((c) =>
    c.type === "text" && typeof c.text === "string" ? { ...c, text: c.text.replace(/\n[ \t]+/g, "\n") } : c,
  );
  // Blancs et saut de ligne laissés juste après le marqueur : sans effet visuel voulu
  const firstNext = next[0];
  if (firstNext?.type === "text" && typeof firstNext.text === "string" && /^\s/.test(firstNext.text)) {
    const trimmed = firstNext.text.replace(/^\s+/, "");
    if (trimmed) next[0] = { ...firstNext, text: trimmed };
    else next.shift();
  }
  return {
    ...block,
    type: "callout",
    props: { type: ALIASES[m[1].toLowerCase()] },
    content: next,
  };
}

/** Paragraphe réduit à un lien « Intégration … » (import BookStack d'un iframe) → bloc d'intégration */
function linkToEmbed(block: AnyBlock, peertubeHosts: string[]): AnyBlock | null {
  const content = asInline(block.content)?.filter((c) => !(c.type === "text" && !c.text?.trim()));
  if (!content || content.length !== 1 || content[0].type !== "link" || !content[0].href) return null;
  if (!/^intégration\b/i.test(inlineText(asInline(content[0].content) ?? []).trim())) return null;
  if (!toEmbed(content[0].href, peertubeHosts)) return null;
  return { id: block.id, type: "embed", props: { url: content[0].href }, children: block.children ?? [] };
}

/**
 * Après une conversion Markdown → blocs : reconstruit les éléments BookStack que le Markdown ne sait pas
 * exprimer (encadrés, intégrations). Récursif (blocs imbriqués).
 */
export function liftBookStackBlocks<T>(blocks: T[], peertubeHosts: string[] = []): T[] {
  return (blocks as AnyBlock[]).map((b) => {
    const children = b.children?.length ? liftBookStackBlocks(b.children, peertubeHosts) : b.children;
    const block = children === b.children ? b : { ...b, children };
    if (block.type === "quote") return quoteToCallout(block) ?? block;
    if (block.type === "paragraph") return linkToEmbed(block, peertubeHosts) ?? block;
    return block;
  }) as T[];
}

/** Avant l'export Markdown : un encadré devient une citation « > [!TYPE] » (sans perte du type) */
export function lowerCalloutsForMarkdown<T>(blocks: T[]): T[] {
  return (blocks as AnyBlock[]).map((b) => {
    const children = b.children?.length ? lowerCalloutsForMarkdown(b.children) : b.children;
    if (b.type !== "callout") return children === b.children ? b : { ...b, children };
    const type = isCalloutType(b.props?.type) ? b.props.type : "info";
    const content = asInline(b.content) ?? [];
    return {
      ...b,
      type: "quote",
      props: {},
      content: [{ type: "text", text: `${calloutMarker(type)}\n`, styles: {} }, ...content],
      children,
    };
  }) as T[];
}

/** Le texte ressemble-t-il à du Markdown contenant un encadré ? (collage) */
export const hasCalloutMarkdown = (text: string) => /^ {0,3}>\s*\[!(info|note|important|success|tip|warning|caution|danger)\]/im.test(text);
