import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * EmptyState — une ligne courte (« Aucun cours. ») et, au besoin, un bouton.
 * Pas de mode d'emploi : l'action suffit à dire quoi faire.
 *
 *   <EmptyState action={<Link className="btn" href="…">Ajouter un jalon</Link>}>Aucun jalon.</EmptyState>
 */
export function EmptyState({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex flex-wrap items-center justify-between gap-3 border border-dashed border-line-strong/60 px-4 py-5", className)}>
      <p className="text-muted">{children}</p>
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </div>
  );
}
