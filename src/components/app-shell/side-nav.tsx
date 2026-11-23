"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { cx } from "@/components/ui/cx";
import { isActive, type NavSection } from "./nav";

/** Navigation par sections (barre latérale ≥ 1024 px et tiroir mobile) — élément actif : barre bleue à gauche */
export function SideNav({ sections, label, idPrefix }: { sections: NavSection[]; label: string; idPrefix: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="flex flex-col gap-6">
      {sections.map((section) => {
        const headingId = `${idPrefix}-${section.id}`;
        return (
          <div key={section.id} className="flex flex-col gap-1">
            {section.label && (
              <p id={headingId} className="px-2.5 text-xs font-semibold text-muted">
                {section.label}
              </p>
            )}
            <ul aria-labelledby={section.label ? headingId : undefined} className="flex flex-col">
              {section.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cx(
                        "flex min-h-11 items-center gap-2.5 border-l-2 px-2.5 text-sm transition-colors pointer-fine:min-h-9",
                        active ? "border-accent bg-surface font-semibold text-ink" : "border-transparent text-ink hover:bg-line/60",
                      )}
                    >
                      <Icon name={item.icon} size={18} className={cx("shrink-0", active ? "text-accent" : "text-muted")} />
                      <span className="min-w-0 truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
