import { EmptyState, StatusBadge } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { createSaeAnnouncement, deleteSaeAnnouncement } from "../../actions";
import { ActionForm, SubmitButton } from "../../_components/action-form";
import { Checkbox } from "./fields";

export type ManagedAnnouncement = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: Date;
  author: { name: string };
};

type Props = { saeId: string; announcements: ManagedAnnouncement[] };

/** Onglet « Annonces » : rédaction (texte brut) + liste avec suppression */
export function AnnouncementsSection({ saeId, announcements }: Props) {
  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="nouvelle-annonce" className="flex flex-col gap-4">
        <h2 id="nouvelle-annonce" className="text-xl">
          Nouvelle annonce
        </h2>
        <ActionForm
          action={createSaeAnnouncement}
          resetOnSuccess
          className="flex max-w-2xl flex-col gap-4"
          aria-label="Publier une annonce"
        >
          <input type="hidden" name="saeId" value={saeId} />
          <div>
            <label htmlFor="announcement-title" className="label">
              Titre
            </label>
            <input id="announcement-title" name="title" className="input" required maxLength={190} />
          </div>
          <div>
            <label htmlFor="announcement-body" className="label">
              Message
            </label>
            <textarea id="announcement-body" name="body" className="input py-2" rows={4} required maxLength={10000} />
          </div>
          <Checkbox id="announcement-pinned" name="pinned">
            Épingler en tête de la SAÉ
          </Checkbox>
          <div>
            <SubmitButton pendingLabel="Publication…">Publier l&apos;annonce</SubmitButton>
          </div>
        </ActionForm>
      </section>

      <section aria-labelledby="annonces-publiees" className="flex flex-col gap-4">
        <h2 id="annonces-publiees" className="text-xl">
          Publiées
        </h2>
        {announcements.length === 0 ? (
          <EmptyState>Aucune annonce.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {announcements.map((a) => (
              <li key={a.id} className="flex flex-col gap-2 py-4 first:pt-0">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                      <p className="font-semibold break-words">{a.title}</p>
                      {a.pinned && <StatusBadge>Épinglée</StatusBadge>}
                    </div>
                    <p className="flex flex-wrap gap-x-4 text-sm text-muted">
                      <span>{a.author.name}</span>
                      <time dateTime={a.createdAt.toISOString()}>{formatDateTime(a.createdAt)}</time>
                    </p>
                  </div>
                  <ActionForm action={deleteSaeAnnouncement} quiet confirmMessage={`Supprimer l'annonce « ${a.title} » ?`}>
                    <input type="hidden" name="announcementId" value={a.id} />
                    <SubmitButton
                      className="btn btn-danger"
                      pendingLabel="Suppression…"
                      aria-label={`Supprimer l'annonce « ${a.title} »`}
                    >
                      Supprimer
                    </SubmitButton>
                  </ActionForm>
                </div>
                <p className="max-w-prose break-words whitespace-pre-line">{a.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
