// Petits composants d'affichage de la liste « À faire » de l'accueil (sans état, rendus serveur).
import type { ReactNode } from "react";
import { DeadlineChip as UiDeadlineChip } from "@/components/ui";

/** Échéance (composant partagé) ; « Sans date » si le jalon n'a pas d'échéance */
export function DeadlineChip({ due, now, done = false }: { due: Date | null; now: Date; done?: boolean }) {
  if (!due) return <span className="badge">Sans date</span>;
  return <UiDeadlineChip due={due} now={now} done={done} />;
}

/** Section titrée de la liste ; n'est rendue que si elle contient quelque chose */
export function TodoSection({ id, title, tone, children }: { id: string; title: string; tone?: "danger"; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-3">
      <h3 id={`${id}-title`} className={`text-base ${tone === "danger" ? "text-danger" : ""}`}>
        {title}
      </h3>
      <ul className="flex flex-col divide-y divide-line border-y border-line">{children}</ul>
    </section>
  );
}

/** Ligne : échéance à gauche, contenu, action à droite */
export function Row({ chip, children, action }: { chip?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <li className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:gap-6">
      {chip && <div className="shrink-0 sm:w-32">{chip}</div>}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </li>
  );
}

/** Code ou titre court de la SAÉ (ligne secondaire) */
export function SaeLine({ sae }: { sae: { code: string | null; title: string } }) {
  return <span className="text-sm break-words text-muted">{sae.code ?? sae.title}</span>;
}
