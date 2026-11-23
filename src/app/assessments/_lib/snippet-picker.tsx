"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { appendSnippet, MAX_BODY, type SnippetView } from "./shared";

type Props = {
  snippets: SnippetView[];
  /** id du <textarea> (non contrôlé) dans lequel insérer le texte */
  targetId: string;
  /** Étiquette présélectionnée si elle existe (ex. code AC du critère) */
  defaultTag?: string | null;
  maxLength?: number;
};

const ALL = "";

function excerpt(text: string, max = 90) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/** « Insérer un commentaire type » : filtre par étiquette, puis ajoute le texte à la fin du champ ciblé */
export function SnippetPicker({ snippets, targetId, defaultTag, maxLength = MAX_BODY }: Props) {
  const uid = useId();
  const tags = useMemo(
    () =>
      [...new Set(snippets.map((s) => s.tag).filter((t): t is string => !!t))].sort((a, b) =>
        a.localeCompare(b, "fr"),
      ),
    [snippets],
  );
  const initialTag = defaultTag ? (tags.find((t) => t.toLowerCase() === defaultTag.toLowerCase()) ?? ALL) : ALL;
  const [tag, setTag] = useState(initialTag);
  const [selectedId, setSelectedId] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const filtered = tag === ALL ? snippets : snippets.filter((s) => s.tag === tag);

  function insert() {
    const snippet = filtered.find((s) => s.id === selectedId);
    if (!snippet) {
      setMessage({ ok: false, text: "Choisissez d'abord un commentaire type." });
      return;
    }
    const target = document.getElementById(targetId);
    if (!(target instanceof HTMLTextAreaElement)) return;
    const next = appendSnippet(target.value, snippet.body);
    if (next.length > maxLength) {
      setMessage({ ok: false, text: `Insertion impossible : le texte dépasserait ${maxLength} caractères.` });
      return;
    }
    target.value = next;
    // Événement natif : permet au formulaire parent de savoir qu'il a été modifié
    target.dispatchEvent(new Event("input", { bubbles: true }));
    target.focus();
    target.setSelectionRange(next.length, next.length);
    setSelectedId("");
    setMessage({ ok: true, text: "Commentaire type inséré." });
  }

  return (
    <details className="border border-line">
      <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-semibold">
        Insérer un commentaire type
      </summary>
      <div className="flex flex-col gap-3 border-t border-line p-3">
        {snippets.length === 0 ? (
          <p className="text-sm text-muted">
            Aucun commentaire type.{" "}
            <Link href="/me/comment-bank" className="link">
              Banque de commentaires
            </Link>
          </p>
        ) : (
          <>
            {tags.length > 0 && (
              <div>
                <label htmlFor={`${uid}-tag`} className="label">
                  Filtrer par étiquette
                </label>
                <select
                  id={`${uid}-tag`}
                  value={tag}
                  onChange={(e) => {
                    setTag(e.target.value);
                    setSelectedId("");
                    setMessage(null);
                  }}
                  className="input"
                >
                  <option value={ALL}>Toutes les étiquettes ({snippets.length})</option>
                  {tags.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label htmlFor={`${uid}-snippet`} className="label">
                Commentaire type
              </label>
              <select
                id={`${uid}-snippet`}
                value={selectedId}
                onChange={(e) => {
                  setSelectedId(e.target.value);
                  setMessage(null);
                }}
                className="input"
              >
                <option value="">
                  {filtered.length === 0 ? "Aucun commentaire pour cette étiquette" : "Choisir…"}
                </option>
                {filtered.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.tag && tag === ALL ? `[${s.tag}] ` : ""}
                    {excerpt(s.body)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={insert} className="btn" disabled={selectedId === ""}>
                Insérer
              </button>
              <Link href="/me/comment-bank" className="link inline-flex min-h-11 items-center text-sm">
                Banque de commentaires
              </Link>
            </div>
          </>
        )}
        <p role="status" aria-live="polite" className={message && !message.ok ? "form-error" : "text-sm text-ok"}>
          {message?.text ?? ""}
        </p>
      </div>
    </details>
  );
}
