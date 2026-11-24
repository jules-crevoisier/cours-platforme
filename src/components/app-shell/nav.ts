// Structure de navigation (données pures, sérialisables vers les composants clients).
import type { IconName } from "@/components/ui/icon";
import type { Role } from "@/lib/permissions";

export type NavItem = { href: string; label: string; icon: IconName; exclude?: string[] };
export type NavSection = { id: string; label?: string; items: NavItem[]; collapsible?: boolean };

const HOME: NavItem = { href: "/", label: "Accueil", icon: "home" };
const COURSES: NavItem = { href: "/courses", label: "Cours", icon: "book" };
const SAES: NavItem = { href: "/saes", label: "SAÉ", icon: "track" };

/** Navigation principale : barre latérale (≥ 1024 px) et barre d'onglets basse (< 1024 px) */
export const MAIN_ITEMS: NavItem[] = [HOME, COURSES, SAES];

/**
 * Sections de la barre latérale selon le rôle.
 * Tout le monde : Accueil, Cours, SAÉ (la lecture au centre). Le secondaire (vitrine, profil, compétences,
 * paramètres, banque de commentaires) est dans le menu du compte.
 * Équipe pédagogique : + Enseignement (Étudiants, Annonces). Administrateur : + Administration (repliée).
 */
export function navSections(role: Role): NavSection[] {
  const staff = role === "ADMIN" || role === "TEACHER";
  const sections: NavSection[] = [{ id: "principal", items: MAIN_ITEMS }];
  if (staff) {
    sections.push({
      id: "enseignement",
      label: "Enseignement",
      items: [
        { href: "/students", label: "Étudiants", icon: "users" },
        { href: "/admin/announcements", label: "Annonces", icon: "megaphone" },
      ],
    });
  }
  if (role === "ADMIN") {
    sections.push({
      id: "admin",
      label: "Administration",
      collapsible: true,
      items: [
        { href: "/admin/users", label: "Utilisateurs", icon: "user" },
        { href: "/admin/cohorts", label: "Promos", icon: "layers" },
        { href: "/admin/referentiel", label: "Référentiel", icon: "grid" },
      ],
    });
  }
  return sections;
}

/** Liens du menu du compte (barre latérale et tiroir mobile) */
export function accountItems(role: Role): NavItem[] {
  const staff = role === "ADMIN" || role === "TEACHER";
  return [
    { href: "/me", label: "Mon profil", icon: "user" },
    ...(staff
      ? []
      : [
          { href: "/me/competences", label: "Mes compétences", icon: "radar" } satisfies NavItem,
          { href: "/me/portfolio", label: "Portfolio", icon: "folder" } satisfies NavItem,
        ]),
    { href: "/vitrine", label: "Vitrine", icon: "gallery" },
    ...(staff ? [{ href: "/me/comment-bank", label: "Banque de commentaires", icon: "message" } satisfies NavItem] : []),
    { href: "/me/settings", label: "Paramètres", icon: "sliders" },
    { href: "/aide", label: "Aide", icon: "help" },
  ];
}

/** Actif si la page courante est la cible ou l'une de ses sous-pages ("/" : exact) */
export function isActive(pathname: string, href: string, exclude: string[] = []) {
  if (exclude.some((e) => isActive(pathname, e))) return false;
  if (href === "/admin/users") return isActive(pathname, "/admin");
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "");
  return letters.toUpperCase() || "?";
}

/**
 * Rail d'icônes (≥ 1024 px) : Accueil, Cours, SAÉ ; équipe pédagogique : Étudiants, Annonces ; administrateur : Admin.
 * Une seule navigation « application » ; le sommaire du cours reste la seule navigation textuelle d'une page de cours.
 */
export function railItems(role: Role): NavItem[] {
  const items: NavItem[] = [...MAIN_ITEMS];
  if (role === "ADMIN" || role === "TEACHER") {
    items.push({ href: "/students", label: "Étudiants", icon: "users" });
    items.push({ href: "/admin/announcements", label: "Annonces", icon: "megaphone" });
  }
  if (role === "ADMIN") items.push({ href: "/admin/users", label: "Admin", icon: "layers", exclude: ["/admin/announcements"] });
  return items;
}
