import type { ReactNode } from "react";
import { cx } from "@/components/ui";
import { toInputDateTime } from "../../_lib/dates";
import type { FormAction } from "../../_lib/form-state";
import { ActionForm, SubmitButton } from "../../_components/action-form";

/** Case à cocher avec une zone cliquable ≥ 44 px */
export function Checkbox({ id, name, defaultChecked, children }: {
  id: string;
  name: string;
  defaultChecked?: boolean;
  children: ReactNode;
}) {
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
      <input id={id} name={name} type="checkbox" defaultChecked={defaultChecked} className="size-5 accent-accent" />
      <span>{children}</span>
    </label>
  );
}

type MilestoneDefaults = {
  title: string;
  description: string | null;
  dueAt: Date | null;
  requiresDepositUrl: boolean;
  peerReviewEnabled: boolean;
};

export function MilestoneFields({ idPrefix, defaults }: { idPrefix: string; defaults?: MilestoneDefaults }) {
  const f = (name: string) => `${idPrefix}-${name}`;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="md:col-span-2">
        <label htmlFor={f("title")} className="label">
          Titre du jalon
        </label>
        <input
          id={f("title")}
          name="title"
          className="input"
          required
          maxLength={190}
          placeholder="Revue de conception"
          defaultValue={defaults?.title ?? ""}
        />
      </div>
      <div className="md:col-span-2">
        <label htmlFor={f("description")} className="label">
          Description <span className="font-normal text-muted">(optionnel)</span>
        </label>
        <textarea
          id={f("description")}
          name="description"
          className="input py-2"
          rows={3}
          maxLength={5000}
          defaultValue={defaults?.description ?? ""}
        />
      </div>
      <div>
        <label htmlFor={f("dueAt")} className="label">
          Échéance <span className="font-normal text-muted">(heure de Paris)</span>
        </label>
        <input
          id={f("dueAt")}
          name="dueAt"
          type="datetime-local"
          className="input"
          defaultValue={toInputDateTime(defaults?.dueAt)}
        />
      </div>
      <div className="flex flex-col justify-end">
        <Checkbox id={f("requiresDepositUrl")} name="requiresDepositUrl" defaultChecked={defaults?.requiresDepositUrl}>
          Dépôt d&apos;URL requis
        </Checkbox>
        <Checkbox id={f("peerReviewEnabled")} name="peerReviewEnabled" defaultChecked={defaults?.peerReviewEnabled}>
          Évaluation entre pairs
        </Checkbox>
      </div>
    </div>
  );
}

/** Boutons « monter / descendre » (un formulaire par sens) */
export function MoveButtons({
  action,
  idName,
  idValue,
  label,
  isFirst,
  isLast,
}: {
  action: FormAction;
  idName: string;
  idValue: string;
  label: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <div className="flex shrink-0 gap-1">
      <ActionForm action={action} quiet>
        <input type="hidden" name={idName} value={idValue} />
        <input type="hidden" name="direction" value="up" />
        <SubmitButton className="btn min-w-11 px-0" disabled={isFirst} aria-label={`Monter ${label}`} title="Monter">
          <span aria-hidden="true">↑</span>
        </SubmitButton>
      </ActionForm>
      <ActionForm action={action} quiet>
        <input type="hidden" name={idName} value={idValue} />
        <input type="hidden" name="direction" value="down" />
        <SubmitButton
          className="btn min-w-11 px-0"
          disabled={isLast}
          aria-label={`Descendre ${label}`}
          title="Descendre"
        >
          <span aria-hidden="true">↓</span>
        </SubmitButton>
      </ActionForm>
    </div>
  );
}

/**
 * Bloc repliable (actions rares, formulaires de modification) sans état client.
 * Dans une rangée `flex-wrap`, passer `className="open:basis-full"` pour que le contenu ouvert prenne toute la largeur.
 */
export function EditDisclosure({
  summary,
  children,
  className,
}: {
  summary: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details className={cx("group", className)}>
      <summary className="btn cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        {summary}
        <span aria-hidden="true" className="transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}
