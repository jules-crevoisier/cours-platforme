"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type CopyFieldProps = {
  id: string;
  label: string;
  value: string;
  /** Actions supplémentaires sur la même ligne que « Copier » (ex. « Ouvrir ») */
  children?: ReactNode;
};

/**
 * Lien à copier : champ en lecture seule + bouton « Copier » (repli : sélection du texte).
 * Partagé par le partage du portfolio et l'abonnement d'agenda (/me/settings).
 */
export function CopyField({ id, label, value, children }: CopyFieldProps) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state === "idle") return;
    const t = window.setTimeout(() => setState("idle"), 3000);
    return () => window.clearTimeout(t);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      inputRef.current?.select();
      setState("failed");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="label mb-0">
        {label}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          ref={inputRef}
          id={id}
          readOnly
          value={value}
          spellCheck={false}
          onFocus={(e) => e.currentTarget.select()}
          className="input min-w-0 font-mono text-sm sm:flex-1"
        />
        <div className="flex flex-wrap gap-2 sm:shrink-0">
          <button type="button" className="btn" onClick={copy} aria-label={`Copier : ${label}`}>
            {state === "copied" ? "Copié" : "Copier"}
          </button>
          {children}
        </div>
      </div>
      <p role="status" aria-live="polite" className={state === "failed" ? "form-error" : "text-sm text-ok"}>
        {state === "copied"
          ? "Lien copié."
          : state === "failed"
            ? "Copie impossible : le lien est sélectionné, copiez-le avec Ctrl+C (ou ⌘+C)."
            : ""}
      </p>
    </div>
  );
}

export function PrintButton({ label = "Imprimer / PDF" }: { label?: string }) {
  return (
    <button type="button" className="btn print:hidden" onClick={() => window.print()}>
      {label}
    </button>
  );
}
