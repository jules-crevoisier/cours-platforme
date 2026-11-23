import type { Metadata } from "next";
import Link from "next/link";
import { StatusView } from "@/components/app-shell/status-view";

export const metadata: Metadata = { title: "Accès refusé" };

export default function Forbidden() {
  return (
    <StatusView
      code="403"
      title="Accès refusé"
      actions={
        <>
          <Link href="/" className="btn btn-primary">
            Accueil
          </Link>
          <Link href="/aide" className="btn">
            Aide
          </Link>
        </>
      }
    >
      <p>Votre compte n&apos;a pas les droits nécessaires pour cette page.</p>
    </StatusView>
  );
}
