"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { cx } from "@/components/ui/cx";
import { isActive, type NavItem } from "./nav";

/** Barre d'onglets basse (< 1024 px) : cibles de 56 px, marge de zone sûre iOS ; actif = trait bleu en haut */
export function TabBar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navigation principale"
      className="shell-tabbar fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface lg:hidden"
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href} className="min-w-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "-mt-px flex min-h-14 flex-col items-center justify-center gap-1 border-t-2 px-1 text-xs font-semibold",
                  active ? "border-accent text-ink" : "border-transparent text-muted",
                )}
              >
                <Icon name={item.icon} size={20} className={active ? "text-accent" : undefined} />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
