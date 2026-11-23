import Link from "next/link";
import { Wordmark } from "@/components/app-shell/parts";

/** En-tête des pages publiques (visiteur non connecté) : le logo, rien d'autre */
export function SiteHeader() {
  return (
    <header className="shell-topbar border-b border-line bg-surface">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center md:px-4">
        <Link href="/" className="flex min-h-11 min-w-0 items-center px-2">
          <Wordmark />
          <span className="sr-only"> — accueil</span>
        </Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="public-main mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 py-4 text-xs text-muted">
      <Link href="/accessibilite" className="inline-flex min-h-11 items-center hover:text-ink hover:underline">
        Accessibilité : non conforme
      </Link>
      <Link href="/aide" className="inline-flex min-h-11 items-center hover:text-ink hover:underline">
        Aide
      </Link>
    </footer>
  );
}
