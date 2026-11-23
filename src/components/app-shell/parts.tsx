import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { cx } from "@/components/ui/cx";
import type { ResolvedFavorite } from "@/lib/favorites";

/** Logo : carré bleu « M » + nom de la plateforme */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cx("flex items-center gap-2.5", className)}>
      <svg aria-hidden="true" viewBox="0 0 32 32" width="28" height="28" className="shrink-0">
        <rect width="32" height="32" fill="var(--accent)" />
        <path d="M7 24V8h4l5 8 5-8h4v16h-4v-9.5L16 21l-5-6.5V24z" fill="var(--accent-ink)" />
      </svg>
      <span className="text-base leading-none font-bold tracking-tight whitespace-nowrap text-ink [font-stretch:115%]">
        Cours &amp; SAÉ
      </span>
    </span>
  );
}

/** Cloche : lien vers /notifications, compteur visuel + libellé complet pour les lecteurs d'écran */
export function NotificationBell({ count, className }: { count: number; className?: string }) {
  const label =
    count === 0 ? "Notifications, aucune non lue" : `Notifications, ${count} non lue${count > 1 ? "s" : ""}`;
  return (
    <Link
      href="/notifications"
      aria-label={label}
      title="Notifications"
      className={cx("relative inline-flex size-11 shrink-0 items-center justify-center text-ink transition-colors", className)}
    >
      <Icon name="bell" />
      {count > 0 && (
        <span
          aria-hidden="true"
          className="absolute top-1.5 right-1.5 flex h-4.5 min-w-4.5 items-center justify-center bg-accent px-1 text-[11px] leading-none font-bold text-accent-ink"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

/** Favoris (étoile sur un cours, une page ou une SAÉ) : rien n'est affiché tant qu'il n'y en a pas */
export function FavoritesNav({ favorites, id, max = 8 }: { favorites: ResolvedFavorite[]; id: string; max?: number }) {
  if (favorites.length === 0) return null;
  const shown = favorites.slice(0, max);
  return (
    <nav aria-labelledby={id} className="flex flex-col gap-1">
      <p id={id} className="px-2.5 text-xs font-semibold text-muted">
        Favoris
      </p>
      <ul className="flex flex-col">
        {shown.map((f) => (
          <li key={f.id}>
            <Link
              href={f.href}
              title={f.context ? `${f.label} — ${f.context}` : f.label}
              className="flex min-h-11 items-center gap-2.5 px-2.5 text-sm text-ink transition-colors hover:bg-line/60 pointer-fine:min-h-9"
            >
              <Icon name="star" size={14} className="shrink-0 text-muted" />
              <span className="min-w-0 flex-1 truncate">{f.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Pied de contenu : mention d'accessibilité obligatoire (RGAA) sur chaque page */
export function ContentFooter({ className }: { className?: string }) {
  return (
    <footer className={cx("mt-20 text-xs text-muted", className)}>
      <Link href="/accessibilite" className="inline-flex min-h-11 items-center hover:text-ink hover:underline">
        Accessibilité : non conforme
      </Link>
    </footer>
  );
}
