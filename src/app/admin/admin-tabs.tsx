"use client";

import { usePathname } from "next/navigation";
import { Tabs } from "@/components/ui";

const ITEMS = [
  { href: "/admin/users", label: "Utilisateurs" },
  { href: "/admin/cohorts", label: "Promos" },
  { href: "/admin/referentiel", label: "Référentiel" },
];

/** Onglets de l'administration (la page Annonces, aussi pour les enseignants, n'en a pas) */
export function AdminTabs() {
  const pathname = usePathname();
  if (!ITEMS.some((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))) return null;
  return (
    <Tabs
      label="Administration"
      className="mb-6"
      items={ITEMS.map((i) => ({ ...i, active: pathname === i.href || pathname.startsWith(`${i.href}/`) }))}
    />
  );
}
