"use client";

import { useOptimistic, useTransition } from "react";
import { togglePageRead } from "@/app/_actions/page-read";

/** « Marquer comme lu » — état optimiste, annulé si le serveur refuse */
export function ReadButton({ pageId, initial }: { pageId: string; initial: boolean }) {
  const [pending, start] = useTransition();
  const [read, setRead] = useOptimistic(initial);

  return (
    <button
      type="button"
      className={`btn ${read ? "" : "btn-primary"}`}
      aria-pressed={read}
      disabled={pending}
      onClick={() =>
        start(async () => {
          setRead(!read);
          await togglePageRead(pageId);
        })
      }
    >
      {read ? "Lue" : "Marquer comme lue"}
      {read && <span className="sr-only"> (cliquer pour annuler)</span>}
    </button>
  );
}
