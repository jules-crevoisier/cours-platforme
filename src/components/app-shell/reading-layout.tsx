import type { ReactNode } from "react";

export type TocEntry = { id: string; label: string };

/**
 * Page de lecture : colonne 65ch, sommaire à gauche (≥ 1024 px, collant),
 * repliable en haut de page en dessous.
 */
export function ReadingLayout({ toc, children }: { toc: TocEntry[]; children: ReactNode }) {
  const list = (
    <ul className="flex flex-col">
      {toc.map((t) => (
        <li key={t.id}>
          <a
            href={`#${t.id}`}
            className="flex min-h-11 items-center border-l-2 border-line px-3 py-2 text-sm text-muted transition-colors hover:border-ink hover:text-ink lg:min-h-9 lg:py-1.5"
          >
            {t.label}
          </a>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-12">
      <nav aria-label="Sommaire" className="lg:sticky lg:top-12 lg:self-start">
        <details className="border border-line bg-surface lg:hidden">
          <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-semibold">Sommaire</summary>
          <div className="border-t border-line p-2">{list}</div>
        </details>
        <div className="hidden lg:block">{list}</div>
      </nav>
      <div className="flex max-w-prose min-w-0 flex-col gap-14">{children}</div>
    </div>
  );
}

/** Section de lecture */
export function ReadingSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-titre`} id={id} className="flex flex-col gap-4">
      <h2 id={`${id}-titre`} className="text-xl">
        {title}
      </h2>
      {children}
    </section>
  );
}
