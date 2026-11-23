import type { Metadata } from "next";
import Link from "next/link";
import { StatusView } from "@/components/app-shell/status-view";

export const metadata: Metadata = { title: "Page introuvable" };

export default function NotFound() {
  return (
    <StatusView
      code="404"
      title="Cette page n'existe pas, ou plus."
      actions={
        <>
          <Link href="/" className="btn btn-primary">
            Accueil
          </Link>
          <Link href="/search" className="btn">
            Rechercher
          </Link>
        </>
      }
    />
  );
}
