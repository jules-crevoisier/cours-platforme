import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * PageHeader — fil d'Ariane, titre, actions. Une seule en-tête pour toutes les pages.
 * `meta` : une ligne factuelle facultative (dates, groupe…), jamais une phrase d'explication.
 *
 *   <PageHeader
 *     breadcrumbs={[{ label: "SAÉ", href: "/saes" }, { label: "SAÉ 2.03" }]}
 *     title="Concevoir un site web avec une source de données"
 *     meta={<><span>S2</span><span>6 jalons</span></>}
 *     actions={<Link className="btn btn-primary" href="…">Gérer</Link>}
 *   />
 */
export type Crumb = { label: string; href?: string };

type Props = {
  title: ReactNode;
  breadcrumbs?: Crumb[];
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ title, breadcrumbs, meta, actions, className }: Props) {
  return (
    <header className={cx("flex flex-col gap-4 md:flex-row md:items-end md:justify-between", className)}>
      <div className="flex min-w-0 flex-col gap-2">
        {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}
        <h1 className="text-2xl break-words md:text-3xl">{title}</h1>
        {meta && <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 md:shrink-0 md:justify-end">{actions}</div>}
    </header>
  );
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Fil d'Ariane">
      <ol className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
        {items.map((c, i) => (
          <li key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-2">
            {i > 0 && <span aria-hidden="true">/</span>}
            {c.href ? (
              <Link href={c.href} className="break-words hover:text-ink hover:underline">
                {c.label}
              </Link>
            ) : (
              <span aria-current="page" className="break-words text-ink">
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
