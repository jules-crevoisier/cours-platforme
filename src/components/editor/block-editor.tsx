"use client";

import "@blocknote/mantine/style.css";
import "./editor.css";
import { useEffect, useRef, useState, useTransition } from "react";
import { BlockNoteEditor } from "@blocknote/core";
import { filterSuggestionItems } from "@blocknote/core/extensions";
import { fr } from "@blocknote/core/locales";
import { syntaxHighlighter } from "@blocknote/code-block";
import { SuggestionMenuController, useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { createEditorSchema, type EditorPartialBlock } from "./schema";
import { getSlashMenuItems } from "./slash-menu";
import { shouldPasteAsMarkdown } from "@/lib/paste";

export type SaveResult = { ok: true } | { ok: false; error: string };
export type SaveContent = (content: unknown, markdown: string) => Promise<SaveResult>;

type Props = {
  /** Blocs BlockNote déjà enregistrés (JSON) */
  initialContent?: unknown;
  /** Markdown de repli si aucun bloc (ex. import BookStack) */
  initialMarkdown?: string | null;
  editable?: boolean;
  /** Server Action liée à la ressource ; absente = lecture seule */
  onSave?: SaveContent;
  /** Instances PeerTube / Esup-Pod autorisées (lues côté serveur : getPeertubeHosts()) */
  peertubeHosts?: string[];
};

type Status = "idle" | "dirty" | "saving" | "saved" | "error";

const STATUS_LABEL: Record<Status, string> = {
  idle: "Enregistrement automatique",
  dirty: "Modifications non enregistrées…",
  saving: "Enregistrement…",
  saved: "Enregistré",
  error: "Non enregistré",
};

const NO_HOSTS: string[] = [];

/**
 * Éditeur « à la Notion » : tapez « / » pour insérer un bloc (dont « Intégration » : Figma, YouTube, CodePen…),
 * le Markdown est reconnu à la frappe (#, -, 1., ```, >) et au collage. Blocs de code colorés.
 * Enregistre automatiquement 1 s après la dernière frappe ; seul l'état d'enregistrement est affiché (pas de mode d'emploi).
 */
export default function BlockEditor({ initialContent, initialMarkdown, editable = false, onSave, peertubeHosts = NO_HOSTS }: Props) {
  const canEdit = editable && !!onSave;
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Schéma figé pour la durée de vie de l'éditeur (superset du schéma par défaut)
  const [schema] = useState(() => createEditorSchema(peertubeHosts));

  // Contenu uniquement en Markdown (import BookStack, seed) : conversion AVANT la création
  // de l'éditeur, pour qu'elle ne soit ni annulable (Ctrl+Z) ni enregistrée comme une modification.
  const [startBlocks] = useState<EditorPartialBlock[] | undefined>(() => {
    if (Array.isArray(initialContent) && initialContent.length > 0) return initialContent as EditorPartialBlock[];
    if (!initialMarkdown) return undefined;
    const blocks = BlockNoteEditor.create({ schema }).tryParseMarkdownToBlocks(initialMarkdown);
    return blocks.length > 0 ? blocks : undefined;
  });

  const editor = useCreateBlockNote({
    schema,
    dictionary: fr,
    initialContent: startBlocks,
    extensions: [syntaxHighlighter],
    // Pas de soulignement rouge du correcteur dans un document de cours (code, noms propres, termes techniques)
    domAttributes: { editor: { spellcheck: "false" } },
    // Du Markdown brut (fichier .md, VS Code…) est converti en blocs ; un collage ne doit jamais faire planter la page
    pasteHandler: ({ event, editor: ed, defaultPasteHandler }) => {
      try {
        const text = event.clipboardData?.getData("text/plain") ?? "";
        const html = event.clipboardData?.getData("text/html") ?? "";
        if (shouldPasteAsMarkdown(text, html)) {
          event.preventDefault();
          ed.pasteMarkdown(text);
          return true;
        }
        return defaultPasteHandler();
      } catch (e) {
        console.error("Collage : conversion impossible, collage en texte brut", e);
        const text = event.clipboardData?.getData("text/plain") ?? "";
        event.preventDefault();
        if (text) ed.pasteText(text);
        return true;
      }
    },
  });

  // Ne pas perdre une frappe si on quitte la page avant l'autosave
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (status === "dirty" || status === "saving") e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);

  const inFlight = useRef(false);
  const again = useRef(false);

  // Une seule sauvegarde à la fois ; une erreur (réseau, serveur, proxy) s'affiche dans la barre d'état
  // mais ne doit JAMAIS remonter à la page d'erreur : le contenu reste dans l'éditeur.
  function save() {
    if (!onSave) return;
    if (inFlight.current) {
      again.current = true;
      return;
    }
    inFlight.current = true;
    setStatus("saving");
    const blocks = editor.document;
    const markdown = editor.blocksToMarkdownLossy(blocks);
    startTransition(async () => {
      try {
        const res = await onSave(blocks, markdown);
        if (res.ok) {
          setStatus("saved");
          setError(null);
        } else {
          setStatus("error");
          setError(res.error);
        }
      } catch (e) {
        console.error("Enregistrement échoué", e);
        setStatus("error");
        setError("connexion au serveur impossible, nouvel essai à la prochaine modification");
      } finally {
        inFlight.current = false;
        if (again.current) {
          again.current = false;
          timer.current = setTimeout(save, 500);
        }
      }
    });
  }

  function handleChange() {
    if (!canEdit) return;
    setStatus("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, 1000);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
      {canEdit && (
        <p
          role="status"
          aria-live="polite"
          className={`flex min-h-9 items-center justify-end border-b border-line px-3 text-sm ${
            status === "error" ? "text-danger" : "text-muted"
          }`}
        >
          {STATUS_LABEL[status]}
          {error ? ` — ${error}` : ""}
        </p>
      )}
      <div className={canEdit ? "py-4" : "py-6 md:py-8"}>
        <BlockNoteView
          editor={editor}
          editable={canEdit}
          onChange={handleChange}
          slashMenu={false}
          className="cours-editor"
        >
          {canEdit && (
            <SuggestionMenuController
              triggerCharacter="/"
              getItems={async (query) => filterSuggestionItems(getSlashMenuItems(editor), query)}
            />
          )}
        </BlockNoteView>
      </div>
    </div>
  );
}
