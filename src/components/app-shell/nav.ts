// Structure de navigation (données pures, sérialisables vers les composants clients).
import type { IconName } from "@/components/ui/icon";
import type { Role } from "@/lib/permissions";

export type NavItem = { href: string; label: string; icon: IconName };
export type NavSection = { id: string; label?: string; items: NavItem[] };

const HOME: NavItem = { href: "/", label: "Accueil", icon: "home" };
const TODO: NavItem = { href: "/todo", label: "À faire", icon: "todo" };
const COURSES: NavItem = { href: "/courses", label: "Cours", icon: "book" };
const SAES: NavItem = { href: "/saes", label: "SAÉ", icon: "track" };
const SHOWCASE: NavItem = { href: "/vitrine", label: "Vitrine", icon: "gallery" };
const SEARCH: NavItem = { href: "/search", label: "Recherche", icon: "search" };

/** Barre d'onglets basse (< 1024 px) */
export const TAB_ITEMS: NavItem[] = [HOME, TODO, COURSES, SAES, { href: "/me", label: "Moi", icon: "user" }];

/**
 * Sections de la barre latérale selon le rôle.
 * Étudiant : « Moi » = compétences, portfolio, paramètres.
 * Équipe pédagogique : « Enseignement » = banque de commentaires, annonces (canAnnounce autorise les enseignants).
 * Administrateur : + utilisateurs, promos, référentiel.
 */
export function navSections(role: Role): NavSection[] {
  const staff = role === "ADMIN" || role === "TEACHER";
  const sections: NavSection[] = [
    { id: "principal", items: [HOME, TODO, COURSES, SAES, SHOWCASE, SEARCH] },
    {
      id: "moi",
      label: "Moi",
      items: [
        ...(staff
          ? []
          : [
              { href: "/me/competences", label: "Mes compétences", icon: "radar" } satisfies NavItem,
              { href: "/me/portfolio", label: "Portfolio", icon: "folder" } satisfies NavItem,
            ]),
        { href: "/me/settings", label: "Paramètres", icon: "sliders" },
      ],
    },
  ];
  if (staff) {
    sections.push({
      id: "enseignement",
      label: "Enseignement",
      items: [
        { href: "/me/comment-bank", label: "Banque de commentaires", icon: "message" },
        { href: "/admin/announcements", label: "Annonces", icon: "megaphone" },
      ],
    });
  }
  if (role === "ADMIN") {
    sections.push({
      id: "admin",
      label: "Administration",
      items: [
        { href: "/admin/users", label: "Utilisateurs", icon: "users" },
        { href: "/admin/cohorts", label: "Promos", icon: "layers" },
        { href: "/admin/referentiel", label: "Référentiel", icon: "grid" },
        { href: "/admin/referentiel/couverture", label: "Couverture AC", icon: "grid" },
      ],
    });
  }
  return sections;
}

/** Actif si la page courante est la cible ou l'une de ses sous-pages ("/" : exact) */
export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "");
  return letters.toUpperCase() || "?";
}
