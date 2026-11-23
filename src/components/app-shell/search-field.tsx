"use client";

import { useEffect, useRef } from "react";
import { Icon } from "@/components/ui/icon";

/** Champ de recherche de la barre latérale : envoie vers /search, Ctrl+K (⌘K) ou « / » le met au point */
export function SearchField() {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        ref.current?.focus();
        ref.current?.select();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form action="/search" role="search" className="relative">
      <label htmlFor="recherche-globale" className="sr-only">
        Rechercher dans les cours, pages et SAÉ
      </label>
      <Icon name="search" size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
      <input
        ref={ref}
        id="recherche-globale"
        name="q"
        type="search"
        placeholder="Rechercher"
        autoComplete="off"
        className="input min-h-10 border-line bg-surface pr-14 pl-9 text-sm"
      />
      <kbd aria-hidden="true" className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 border border-line px-1.5 text-xs text-muted">
        Ctrl K
      </kbd>
    </form>
  );
}
