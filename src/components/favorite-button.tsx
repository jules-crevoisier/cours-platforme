"use client";

import { useOptimistic, useTransition } from "react";
import { toggleFavorite } from "@/app/_actions/favorites";

type Props = { kind: "COURSE" | "PAGE" | "SAE"; targetId: string; initial: boolean; label?: string };

/** Étoile « favori » — état optimiste, annulé si le serveur refuse */
export function FavoriteButton({ kind, targetId, initial, label = "cette ressource" }: Props) {
  const [pending, start] = useTransition();
  const [fav, setFav] = useOptimistic(initial);

  return (
    <button
      type="button"
      className="btn btn-ghost"
      aria-pressed={fav}
      aria-label={fav ? `Retirer ${label} des favoris` : `Ajouter ${label} aux favoris`}
      title={fav ? "Retirer des favoris" : "Ajouter aux favoris"}
      disabled={pending}
      onClick={() =>
        start(async () => {
          setFav(!fav);
          await toggleFavorite(kind, targetId);
        })
      }
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill={fav ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="miter"
        className={fav ? "text-accent" : undefined}
      >
        <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
      </svg>
      <span className="sr-only md:not-sr-only">Favori</span>
    </button>
  );
}
