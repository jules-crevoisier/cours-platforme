import Link from "next/link";
import { cx } from "./cx";

/**
 * Tabs — onglets de navigation (liens), pour découper une page de gestion.
 * L'onglet actif est calculé par la page (ex. `?onglet=jalons`) : aucun état client.
 *
 *   <Tabs label="Gestion de la SAÉ" items={[{ href: "?onglet=infos", label: "Infos", active: tab === "infos" }, …]} />
 */
export type TabItem = { href: string; label: string; active: boolean; count?: number };

export function Tabs({ items, label, className }: { items: TabItem[]; label: string; className?: string }) {
  return (
    <nav aria-label={label} className={cx("-mx-1 overflow-x-auto border-b border-line", className)}>
      <ul className="flex min-w-max gap-1 px-1">
        {items.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              aria-current={t.active ? "page" : undefined}
              className={cx(
                "-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition-colors",
                t.active ? "border-accent text-ink" : "border-transparent text-muted hover:border-line-strong hover:text-ink",
              )}
            >
              {t.label}
              {t.count != null && t.count > 0 && <span className="text-muted">{t.count}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
