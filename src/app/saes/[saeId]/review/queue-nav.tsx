"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type MouseEvent } from "react";

type Props = {
  prevHref: string | null;
  nextHref: string | null;
  position: number;
  total: number;
};

/** Saisie en cours : champs texte, zones de texte, listes, contenu éditable (les raccourcis sont ignorés) */
function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) {
    return !["radio", "checkbox", "button", "submit", "reset"].includes(target.type);
  }
  return false;
}

/** Le formulaire de positionnement signale ses modifications non enregistrées par data-dirty */
function confirmLeave() {
  if (!document.querySelector('form[data-dirty="true"]')) return true;
  return window.confirm("Des modifications non enregistrées seront perdues. Continuer ?");
}

/**
 * Navigation dans la file de correction : Précédent / position / Suivant.
 * Raccourcis clavier j (suivant) et k (précédent), inactifs pendant la saisie dans un champ
 * et avec une touche de modification ; annoncés par aria-keyshortcuts et l'infobulle des liens.
 */
export function QueueNav({ prevHref, nextHref, position, total }: Props) {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
      if (isTyping(event.target)) return;
      const href = event.key === "j" ? nextHref : event.key === "k" ? prevHref : null;
      if (!href) return;
      event.preventDefault();
      if (confirmLeave()) router.push(href);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [nextHref, prevHref, router]);

  function guard(event: MouseEvent<HTMLAnchorElement>) {
    if (!confirmLeave()) event.preventDefault();
  }

  return (
    <nav aria-label="Navigation dans la file" className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
      {prevHref ? (
        <Link
          href={prevHref}
          onClick={guard}
          className="btn justify-self-start"
          rel="prev"
          aria-keyshortcuts="k"
          title="Raccourci : k"
        >
          <span aria-hidden="true">←</span> Précédent
        </Link>
      ) : (
        <span className="btn justify-self-start opacity-50" aria-disabled="true">
          <span aria-hidden="true">←</span> Précédent
          <span className="sr-only"> (aucune auto-évaluation précédente)</span>
        </span>
      )}
      <p className="text-sm">
        <span className="sr-only">Auto-évaluation </span>
        {position} sur {total}
      </p>
      {nextHref ? (
        <Link
          href={nextHref}
          onClick={guard}
          className="btn justify-self-end"
          rel="next"
          aria-keyshortcuts="j"
          title="Raccourci : j"
        >
          Suivant <span aria-hidden="true">→</span>
        </Link>
      ) : (
        <span className="btn justify-self-end opacity-50" aria-disabled="true">
          Suivant <span aria-hidden="true">→</span>
          <span className="sr-only"> (aucune auto-évaluation suivante)</span>
        </span>
      )}
    </nav>
  );
}
