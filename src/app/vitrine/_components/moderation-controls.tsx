"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import type { ActionResult } from "@/app/me/portfolio/_lib/shared";
import type { ModerationDecision } from "../_lib/showcase";

type Props = {
  status: "PENDING" | "PUBLISHED";
  groupName: string;
  action: (input: { decision: ModerationDecision; reason?: string }) => Promise<ActionResult>;
};

/** Publier / refuser une demande, retirer un projet publié (motif facultatif transmis aux membres) */
export function ModerationControls({ status, groupName, action }: Props) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [asking, setAsking] = useState<"refuse" | "unpublish" | null>(null);
  const reasonId = useId();

  function run(decision: ModerationDecision, reason?: string) {
    setResult(null);
    startTransition(async () => {
      try {
        const r = await action({ decision, reason });
        setResult(r);
        if (r.ok) setAsking(null);
      } catch {
        setResult({ ok: false, error: "Action impossible pour le moment. Réessayez." });
      }
    });
  }

  function handleReason(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!asking) return;
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "");
    run(asking, reason);
  }

  return (
    <div className="flex flex-col gap-2 print:hidden">
      {!asking && (
        <div className="flex flex-wrap gap-2">
          {status === "PENDING" && (
            <>
              <button
                type="button"
                className="btn btn-primary"
                disabled={pending}
                onClick={() => run("publish")}
                aria-label={`Publier le projet du groupe ${groupName}`}
              >
                {pending ? "Publication…" : "Publier"}
              </button>
              <button type="button" className="btn" disabled={pending} onClick={() => setAsking("refuse")}>
                Refuser…
              </button>
            </>
          )}
          {status === "PUBLISHED" && (
            <button type="button" className="btn btn-danger" disabled={pending} onClick={() => setAsking("unpublish")}>
              Retirer de la vitrine…
            </button>
          )}
        </div>
      )}

      {asking && (
        <form onSubmit={handleReason} className="flex flex-col gap-2">
          <label htmlFor={reasonId} className="label">
            Motif <span className="font-normal text-muted">(facultatif, envoyé au groupe)</span>
          </label>
          <textarea id={reasonId} name="reason" rows={3} maxLength={500} className="input" />
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn btn-danger" disabled={pending}>
              {pending ? "En cours…" : asking === "refuse" ? "Confirmer le refus" : "Confirmer le retrait"}
            </button>
            <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => setAsking(null)}>
              Annuler
            </button>
          </div>
        </form>
      )}

      <p role="status" aria-live="polite" className={result && !result.ok ? "form-error" : "text-sm text-ok"}>
        {result ? (result.ok ? (result.message ?? "") : result.error) : ""}
      </p>
    </div>
  );
}
