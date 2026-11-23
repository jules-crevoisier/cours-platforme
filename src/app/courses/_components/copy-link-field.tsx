"use client";

import { useId, useState, useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/** Champ en lecture seule + bouton « Copier » pour une URL interne (l'origine est celle du navigateur) */
export function CopyLinkField({ path, label }: { path: string; label: string }) {
  const id = useId();
  const origin = useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => "",
  );
  const url = `${origin}${path}`;
  const [status, setStatus] = useState("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Lien copié.");
    } catch {
      setStatus("Copie impossible : sélectionnez le lien.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={id}
          readOnly
          value={url}
          className="input font-mono"
          onFocus={(e) => e.currentTarget.select()}
        />
        <button type="button" className="btn shrink-0" onClick={copy}>
          Copier
        </button>
      </div>
      <p role="status" aria-live="polite" className="text-sm text-muted">
        {status}
      </p>
    </div>
  );
}
