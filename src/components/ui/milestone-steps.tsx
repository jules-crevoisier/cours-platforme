import Link from "next/link";
import { formatDateShort } from "@/lib/format";
import { DeadlineChip } from "./deadline-chip";
import { cx } from "./cx";

/**
 * MilestoneSteps — la frise des jalons : des carrés reliés, plein si rendu, bleu pour le prochain.
 * Horizontale si la colonne est assez large (≤ 8 jalons), verticale sinon. Le statut est toujours écrit.
 *
 *   <MilestoneSteps
 *     label="Jalons de la SAÉ 2.03"
 *     milestones={sae.milestones.map((m) => ({ id: m.id, title: m.title, dueAt: m.dueAt, href: `…`, status }))}
 *   />
 *
 * Statuts : done (rendu), pending (à venir), late (échéance dépassée sans rendu),
 * none (pas de statut personnel — ex. vue enseignant). Libellés surchargeables via `statusLabels`.
 */
export type MilestoneStatus = "done" | "pending" | "late" | "none";

export type StepMilestone = {
  id: string;
  title: string;
  dueAt: Date | null;
  href?: string;
  status: MilestoneStatus;
};

type Props = {
  milestones: StepMilestone[];
  now?: Date;
  /** Nom accessible de la liste, ex. « Jalons de la SAÉ 2.03 » */
  label?: string;
  statusLabels?: Partial<Record<"done" | "late", string>>;
  className?: string;
};

const MARKER: Record<MilestoneStatus | "next", string> = {
  done: "border-ok bg-ok",
  late: "border-danger bg-danger",
  pending: "border-line-strong bg-surface",
  none: "border-line-strong bg-surface",
  next: "border-accent bg-accent",
};

export function MilestoneSteps({ milestones, now = new Date(), label = "Jalons", statusLabels, className }: Props) {
  if (milestones.length === 0) return <p className={cx("text-muted", className)}>Aucun jalon.</p>;

  const labels = { done: "Rendu", late: "En retard", ...statusLabels };
  const dated = milestones.filter((m) => m.dueAt).sort((a, b) => a.dueAt!.getTime() - b.dueAt!.getTime());
  const ordered = [...dated, ...milestones.filter((m) => !m.dueAt)];
  const nextId = dated.find((m) => m.dueAt! >= now && m.status !== "done")?.id;
  const horizontal = ordered.length <= 8;

  return (
    <div className={cx("@container", className)}>
      <ol aria-label={label} className={cx("grid", horizontal && "@2xl:auto-cols-fr @2xl:grid-flow-col")}>
        {ordered.map((m, i) => {
          const isNext = m.id === nextId;
          const last = i === ordered.length - 1;
          return (
            <li
              key={m.id}
              className={cx(
                "relative grid grid-cols-[1rem_minmax(0,1fr)] gap-x-4",
                !last && "pb-6",
                horizontal && "@2xl:grid-cols-1 @2xl:gap-y-3 @2xl:pr-4 @2xl:pb-0",
              )}
            >
              {!last && (
                <span
                  aria-hidden="true"
                  className={cx(
                    "absolute top-6 bottom-0 left-[7px] w-0.5 bg-line",
                    horizontal && "@2xl:top-[11px] @2xl:right-0 @2xl:bottom-auto @2xl:left-5 @2xl:h-0.5 @2xl:w-auto",
                  )}
                />
              )}
              <span aria-hidden="true" className={cx("relative mt-1 size-4 border-2", MARKER[isNext ? "next" : m.status])} />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm text-muted">{m.dueAt ? formatDateShort(m.dueAt) : "Sans date"}</span>
                {m.href ? (
                  <Link href={m.href} className="self-start font-semibold break-words hover:underline">
                    {m.title}
                  </Link>
                ) : (
                  <span className="font-semibold break-words">{m.title}</span>
                )}
                {m.status === "done" && <span className="badge badge-ok">{labels.done}</span>}
                {m.status === "late" && <span className="badge badge-danger">{labels.late}</span>}
                {isNext && m.dueAt && m.status !== "late" && <DeadlineChip due={m.dueAt} now={now} />}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
