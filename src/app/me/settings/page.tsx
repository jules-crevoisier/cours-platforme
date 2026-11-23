import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/app/admin/users/_components/action-form";
import { calendarFeedUrls, resolveBaseUrl } from "@/app/api/calendar/_lib/calendar";
import { CopyField } from "@/app/me/portfolio/_components/share-tools";
import { disableCalendarToken, regenerateCalendarToken, updateName } from "./actions";

export const metadata: Metadata = { title: "Paramètres" };

async function requestOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : "";
}

export default async function SettingsPage() {
  const session = await requireUser();
  const me = await db.user.findUnique({
    where: { id: session.id },
    select: { name: true, calendarToken: true },
  });
  if (!me) notFound();

  const baseUrl = resolveBaseUrl(process.env.BETTER_AUTH_URL, await requestOrigin());
  const feed = me.calendarToken ? calendarFeedUrls(baseUrl, me.calendarToken) : null;

  return (
    <div className="flex max-w-3xl flex-col gap-10">
      <PageHeader title="Paramètres" />

      {/* ── Compte ───────────────────────────────────────── */}
      <section aria-labelledby="account-title" className="flex flex-col gap-3">
        <h2 id="account-title" className="text-xl">
          Compte
        </h2>
        <ActionForm action={updateName} className="flex flex-col gap-1">
          <label htmlFor="settings-name" className="label mb-0">
            Nom affiché
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="settings-name"
              name="name"
              required
              minLength={2}
              maxLength={80}
              autoComplete="name"
              defaultValue={me.name}
              className="input sm:flex-1"
            />
            <SubmitButton pendingLabel="Enregistrement…" className="btn btn-primary shrink-0">
              Enregistrer
            </SubmitButton>
          </div>
        </ActionForm>
      </section>

      {/* ── Agenda ───────────────────────────────────────── */}
      <section id="calendrier" aria-labelledby="calendar-title" className="flex flex-col gap-3">
        <h2 id="calendar-title" className="text-xl">
          Agenda
        </h2>
        {feed ? (
          <>
            <CopyField id="feed-https" label="Lien d'abonnement" value={feed.https}>
              <a href={feed.webcal} className="btn">
                Ouvrir<span className="sr-only"> dans mon application d&apos;agenda</span>
              </a>
            </CopyField>
            <p className="text-sm text-muted">Lien personnel : ne le partagez pas.</p>
            <details>
              <summary className="btn btn-ghost cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                Plus d&apos;options
              </summary>
              <div className="mt-3 flex flex-wrap items-start gap-2">
                <ActionForm
                  action={regenerateCalendarToken}
                  confirmMessage="Créer un nouveau lien ? L'ancien cessera immédiatement de fonctionner : il faudra réabonner vos agendas."
                  className="flex flex-col items-start"
                >
                  <SubmitButton className="btn" pendingLabel="Renouvellement…">
                    Renouveler le lien
                  </SubmitButton>
                </ActionForm>
                <ActionForm
                  action={disableCalendarToken}
                  confirmMessage="Désactiver le lien ? Vos agendas abonnés ne recevront plus les échéances."
                  className="flex flex-col items-start"
                >
                  <SubmitButton className="btn btn-danger" pendingLabel="Désactivation…">
                    Désactiver le lien
                  </SubmitButton>
                </ActionForm>
              </div>
            </details>
          </>
        ) : (
          <ActionForm action={regenerateCalendarToken} className="flex flex-col items-start">
            <SubmitButton className="btn" pendingLabel="Création…">
              Créer mon lien d&apos;agenda
            </SubmitButton>
          </ActionForm>
        )}
      </section>

      {/* ── RGPD ─────────────────────────────────────────── */}
      <section aria-labelledby="data-title" className="flex flex-col gap-3">
        <h2 id="data-title" className="text-xl">
          Données personnelles
        </h2>
        <p className="text-sm text-muted">
          Pour rectifier ou supprimer votre compte, contactez l&apos;administrateur de la plateforme.
        </p>
        <a href="/me/settings/export" download className="btn self-start">
          Télécharger mes données (JSON)
        </a>
      </section>
    </div>
  );
}
