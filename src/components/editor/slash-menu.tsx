"use client";

import { insertOrUpdateBlockForSlashMenu } from "@blocknote/core/extensions";
import { getDefaultReactSlashMenuItems, type DefaultReactSuggestionItem } from "@blocknote/react";
import { CALLOUT_LABELS, CALLOUT_TYPES, type CalloutType } from "@/lib/bookstack-blocks";
import type { EditorInstance } from "./schema";

function EmbedIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="square"
      strokeLinejoin="miter"
    >
      <path d="M3 5h18v14H3z" />
      <path d="M10 9.5l4.5 2.5-4.5 2.5z" />
    </svg>
  );
}

function CalloutIcon({ type }: { type: CalloutType }) {
  return <span aria-hidden="true" className={`callout-swatch ${type}`} />;
}

const CALLOUT_ALIASES: Record<CalloutType, string[]> = {
  info: ["info", "note", "remarque"],
  success: ["succes", "succès", "astuce", "tip", "ok"],
  warning: ["avertissement", "attention", "warning"],
  danger: ["danger", "erreur", "important", "caution"],
};

/** Menu « / » : tous les éléments par défaut + encadrés BookStack (après « Citation ») + « Intégration » (médias) */
export function getSlashMenuItems(editor: EditorInstance): DefaultReactSuggestionItem[] {
  const items = getDefaultReactSlashMenuItems(editor);
  const mediaGroup = editor.dictionary.slash_menu.video.group;
  const quoteGroup = editor.dictionary.slash_menu.quote.group;

  const calloutItems: DefaultReactSuggestionItem[] = CALLOUT_TYPES.map((type) => ({
    title: `Encadré ${CALLOUT_LABELS[type].toLowerCase()}`,
    subtext: "Bloc mis en évidence, comme dans BookStack",
    aliases: ["encadre", "encadré", "callout", "alerte", ...CALLOUT_ALIASES[type]],
    group: quoteGroup,
    icon: <CalloutIcon type={type} />,
    onItemClick: () => {
      insertOrUpdateBlockForSlashMenu(editor, { type: "callout", props: { type } });
    },
  }));
  const quoteIndex = items.findIndex((i) => i.title === editor.dictionary.slash_menu.quote.title);
  if (quoteIndex === -1) items.push(...calloutItems);
  else items.splice(quoteIndex + 1, 0, ...calloutItems);

  const embedItem: DefaultReactSuggestionItem = {
    title: "Intégration (Figma, YouTube, CodePen…)",
    subtext: "Vidéo, maquette, démo ou modèle 3D affiché dans la page",
    aliases: [
      "integration",
      "intégration",
      "embed",
      "iframe",
      "youtube",
      "vimeo",
      "figma",
      "codepen",
      "peertube",
      "pod",
      "sketchfab",
      "soundcloud",
      "genially",
      "canva",
    ],
    group: mediaGroup,
    icon: <EmbedIcon />,
    onItemClick: () => {
      insertOrUpdateBlockForSlashMenu(editor, { type: "embed" });
    },
  };

  // Les groupes doivent rester contigus : on insère après le dernier élément « médias »
  let lastMedia = -1;
  items.forEach((item, i) => {
    if (item.group === mediaGroup) lastMedia = i;
  });
  if (lastMedia === -1) items.push(embedItem);
  else items.splice(lastMedia + 1, 0, embedItem);
  return items;
}
