"use client";

import Link from "next/link";
import { useEffect } from "react";
import { StatusView } from "@/components/app-shell/status-view";

// Next 16.3 : `retry` (stable) recharge les données du segment puis le re-rend.
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusView
      code="Erreur"
      title="Le chargement de cette page a échoué."
      actions={
        <>
          <button type="button" className="btn btn-primary" onClick={() => retry()}>
            Réessayer
          </button>
          <Link href="/" className="btn">
            Accueil
          </Link>
        </>
      }
    >
      <p>Ce que vous aviez enregistré n&apos;est pas perdu.</p>
      {/* Identifiant à transmettre à l'administrateur : seul usage justifié de la police mono */}
      {error.digest && (
        <p>
          Code : <code className="bg-sunken px-1.5 py-0.5 font-mono text-sm text-ink select-all">{error.digest}</code>
        </p>
      )}
    </StatusView>
  );
}
