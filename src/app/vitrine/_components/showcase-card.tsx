// Carte de projet de la vitrine (rendu serveur). Aucune donnée personnelle au-delà des noms fournis.
// Toute la carte ouvre le projet sur son hébergement d'origine ; visuel du groupe ou, à défaut, une pastille Swatch.
import type { ReactNode } from "react";
import { Swatch } from "@/components/ui";
import { categoryLabel } from "../_lib/showcase";

type Props = {
  /** Identifiant du groupe : couleur stable de la pastille quand il n'y a pas d'image (le titre sinon) */
  id?: string;
  title: string;
  summary: string | null;
  url: string | null;
  imageUrl: string | null;
  category: string | null;
  saeCode: string | null;
  saeTitle: string;
  semester: number | null;
  /** Noms déjà formatés pour l'affichage (« Léa B. » en public) */
  members: string[];
  headingLevel?: "h2" | "h3";
  /** Mention de statut (ex. « En attente ») ajoutée à la ligne de catégorie */
  status?: ReactNode;
};

export function ShowcaseCard({
  id,
  title,
  summary,
  url,
  imageUrl,
  category,
  saeCode,
  saeTitle,
  semester,
  members,
  headingLevel = "h2",
  status,
}: Props) {
  const Heading = headingLevel;
  const safeImage = imageUrl && /^https:\/\//i.test(imageUrl) ? imageUrl : null;
  const safeUrl = url && /^https?:\/\//i.test(url) ? url : null;

  return (
    <article className={`card relative flex h-full flex-col gap-3 ${safeUrl ? "transition-colors hover:border-ink" : ""}`}>
      {safeImage ? (
        // Image externe fournie par le groupe : pas d'optimisation Next (images non optimisées), pas de référent
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={safeImage}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="aspect-[4/3] w-full bg-sunken object-cover"
        />
      ) : (
        <Swatch seed={id ?? title} text={title} size="lg" />
      )}
      <Heading className="text-lg break-words">
        {safeUrl ? (
          <a href={safeUrl} target="_blank" rel="noopener noreferrer nofollow" className="after:absolute after:inset-0 hover:underline">
            {title}
            <span className="sr-only"> (s&apos;ouvre dans un nouvel onglet)</span>
          </a>
        ) : (
          title
        )}
      </Heading>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
        <span>{categoryLabel(category)}</span>
        {saeCode ? <span title={saeTitle}>{saeCode}</span> : semester != null && <span>Semestre {semester}</span>}
        {status}
      </p>
      {summary && <p className="line-clamp-4 text-sm whitespace-pre-line">{summary}</p>}
      {members.length > 0 && (
        <p className="mt-auto text-sm text-muted">
          <span className="sr-only">Membres : </span>
          {members.join(", ")}
        </p>
      )}
    </article>
  );
}
