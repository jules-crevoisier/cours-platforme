import type { ReactNode } from "react";

/**
 * Jeu d'icônes au trait, angles droits (24×24, trait 1,75, currentColor), toujours décoratives :
 * le sens est porté par le texte voisin ou un libellé accessible.
 * Utilisable côté serveur comme côté client (aucun hook).
 */
const PATHS = {
  home: <path d="M3.5 10 12 3.5l8.5 6.5v10.5h-6v-6h-5v6h-6z" />,
  book: (
    <>
      <path d="M3 4.5h6.5L12 7v13.5l-2.5-2H3z" />
      <path d="M21 4.5h-6.5L12 7v13.5l2.5-2H21z" />
    </>
  ),
  /** Jalons posés sur une ligne : l'icône des SAÉ */
  track: (
    <>
      <path d="M3 12h18" />
      <path d="M5 9.5h5v5H5zM14 9.5h5v5h-5z" />
    </>
  ),
  gallery: (
    <>
      <path d="M3 4h18v16H3z" />
      <path d="M7.5 8.5h3v3h-3z" />
      <path d="m21 15-4.5-4.5L7 20" />
    </>
  ),
  search: (
    <>
      <path d="M4 4h12.5v12.5H4z" />
      <path d="m16.5 16.5 4 4" />
    </>
  ),
  bell: (
    <>
      <path d="M6 17.5V9.5a6 6 0 0 1 12 0v8h2.5H3.5z" />
      <path d="M10 20.5h4" />
    </>
  ),
  user: (
    <>
      <path d="M8 3.5h8v8H8z" />
      <path d="M4 21v-3.5a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3V21" />
    </>
  ),
  /** Pentagone : les cinq compétences du référentiel */
  radar: (
    <>
      <path d="M12 3 20.6 9.2l-3.3 10.3H6.7L3.4 9.2z" />
      <path d="m12 8.5 3.3 2.4-1.2 4H9.9l-1.2-4z" />
    </>
  ),
  folder: (
    <>
      <path d="M3 7h18v13H3z" />
      <path d="M8.5 7V3.5h7V7" />
      <path d="M3 12.5h18" />
    </>
  ),
  sliders: (
    <>
      <path d="M3 6h10M17 6h4M3 12h4M11 12h10M3 18h12M19 18h2" />
      <path d="M13 4h4v4h-4zM7 10h4v4H7zM15 16h4v4h-4z" />
    </>
  ),
  message: (
    <>
      <path d="M3.5 3.5h17V17H8l-4.5 3.5z" />
      <path d="M8 8.5h8M8 12.5h5" />
    </>
  ),
  users: (
    <>
      <path d="M6 4h6v6H6z" />
      <path d="M2.5 20v-3a3 3 0 0 1 3-3h7a3 3 0 0 1 3 3v3" />
      <path d="M16 4h3.5v6H16M18.5 14h0.5a2.5 2.5 0 0 1 2.5 2.5V20" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3 9 5-9 5-9-5z" />
      <path d="m3 13 9 5 9-5" />
    </>
  ),
  grid: (
    <>
      <path d="M3.5 3.5h7v7h-7zM13.5 3.5h7v7h-7zM3.5 13.5h7v7h-7zM13.5 13.5h7v7h-7z" />
    </>
  ),
  megaphone: (
    <>
      <path d="M3.5 9h3.5l7-4.5v15L7 15H3.5z" />
      <path d="M17.5 9.5v5M20.5 8v8" />
    </>
  ),
  help: (
    <>
      <path d="M3 3h18v18H3z" />
      <path d="M9.5 9.5V8h5v4H12v2M12 16.5v1" />
    </>
  ),
  logout: (
    <>
      <path d="M10 20.5H3.5v-17H10" />
      <path d="m15.5 16.5 4.5-4.5-4.5-4.5M20 12H9.5" />
    </>
  ),
  /** Carré à moitié plein : bascule de thème clair / sombre */
  contrast: (
    <>
      <path d="M3.5 3.5h17v17h-17z" />
      <path d="M12 3.5h8.5v17H12z" fill="currentColor" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  star: <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  alert: (
    <>
      <path d="M3 3h18v18H3z" />
      <path d="M12 7.5V13M12 16v1" />
    </>
  ),
  clock: (
    <>
      <path d="M3 3h18v18H3z" />
      <path d="M12 7v5h4" />
    </>
  ),
  arrowRight: <path d="M4 12h15M13 6l6 6-6 6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

type IconProps = { name: IconName; size?: number; className?: string; strokeWidth?: number };

export function Icon({ name, size = 20, className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      strokeLinejoin="miter"
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}
