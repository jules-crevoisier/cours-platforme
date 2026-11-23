import type { ReactNode } from "react";

/** Gabarit des pages d'état (404, 403, erreur) : grand code, titre, une phrase, une ou deux actions */
export function StatusView({
  code,
  title,
  children,
  actions,
}: {
  code: string;
  title: string;
  children?: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div className="flex max-w-2xl flex-col gap-4 py-4 md:py-10">
      <p aria-hidden="true" className="text-6xl leading-none font-bold text-accent [font-stretch:125%]">
        {code}
      </p>
      <h1 className="text-2xl md:text-3xl">{title}</h1>
      {children && <div className="max-w-prose text-muted">{children}</div>}
      <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:flex-wrap">{actions}</div>
    </div>
  );
}
