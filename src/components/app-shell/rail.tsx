"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { cx } from "@/components/ui/cx";
import { isActive, type NavItem } from "./nav";

/** Rail d'icônes avec libellé sous l'icône (≥ 1024 px) : l'entrée active est en indigo clair */
export function Rail({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigation principale" className="flex flex-col items-stretch gap-1 px-2">
      {items.map((item) => {
        const active = isActive(pathname, item.href, item.exclude);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[0.6875rem] leading-none transition-colors",
              active ? "bg-accent-soft font-semibold text-accent" : "text-muted hover:bg-sunken hover:text-ink",
            )}
          >
            <Icon name={item.icon} size={22} />
            <span className="max-w-full truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
