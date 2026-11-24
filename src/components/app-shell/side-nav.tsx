"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { cx } from "@/components/ui/cx";
import { isActive, type NavSection } from "./nav";

/** Navigation par sections (barre latérale ≥ 1024 px et tiroir mobile) — élément actif : fond indigo clair */
export function SideNav({ sections, label, idPrefix }: { sections: NavSection[]; label: string; idPrefix: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="flex flex-col gap-6">
      {sections.map((section) => {
        const headingId = `${idPrefix}-${section.id}`;
        const list = (
          <ul aria-labelledby={section.label ? headingId : undefined} className="flex flex-col">
            {section.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors pointer-fine:min-h-9",
                      active ? "bg-accent-soft font-semibold text-accent" : "text-ink hover:bg-sunken",
                    )}
                  >
                    <Icon name={item.icon} size={18} className={cx("shrink-0", active ? "text-accent" : "text-muted")} />
                    <span className="min-w-0 truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        );
        if (section.collapsible && section.label) {
          return (
            <details key={section.id} open={section.items.some((i) => isActive(pathname, i.href))} className="group flex flex-col gap-1">
              <summary
                id={headingId}
                className="flex min-h-9 cursor-pointer list-none items-center justify-between rounded-lg px-2.5 text-xs font-semibold text-muted hover:bg-sunken [&::-webkit-details-marker]:hidden"
              >
                {section.label}
                <Icon name="chevronRight" size={14} className="transition-transform group-open:rotate-90" />
              </summary>
              {list}
            </details>
          );
        }
        return (
          <div key={section.id} className="flex flex-col gap-1">
            {section.label && (
              <p id={headingId} className="px-2.5 text-xs font-semibold text-muted">
                {section.label}
              </p>
            )}
            {list}
          </div>
        );
      })}
    </nav>
  );
}
