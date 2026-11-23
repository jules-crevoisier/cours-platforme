import { deadline, formatDateTime, type DeadlineTone } from "@/lib/format";
import { cx } from "./cx";

/**
 * DeadlineChip — l'échéance en une seule information : « En retard », « Demain », « Dans 3 jours »,
 * puis la date courte au-delà d'une semaine. Ton : warn < 72 h, danger en retard, ok si fait.
 * La date complète est dans `title` et lue par les lecteurs d'écran.
 *
 *   <DeadlineChip due={m.dueAt} />
 *   <DeadlineChip due={m.dueAt} done />
 *
 * Passer `now` depuis le serveur quand le composant est rendu dans un composant client
 * (évite un écart d'hydratation).
 */
const TONE_CLASS: Record<DeadlineTone, string> = {
  overdue: "badge-danger",
  soon: "badge-warn",
  later: "text-ink",
  done: "badge-ok",
};

type Props = {
  due: Date;
  now?: Date;
  done?: boolean;
  className?: string;
};

export function DeadlineChip({ due, now, done = false, className }: Props) {
  const { label, tone } = deadline(due, now, done);
  const full = formatDateTime(due);
  return (
    <time dateTime={due.toISOString()} title={`Échéance : ${full}`} className={cx("badge", TONE_CLASS[tone], className)}>
      {label}
      <span className="sr-only"> (échéance le {full})</span>
    </time>
  );
}
