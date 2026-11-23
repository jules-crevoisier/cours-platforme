"use client";

import { useId, useState } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { EMBED_LABELS, toEmbed, type Embed, type EmbedProvider } from "@/lib/embeds";

/** Rapport largeur/hauteur de l'iframe selon le type de contenu (mobile d'abord) */
const ASPECT_CLASS: Record<Embed["aspect"], string> = {
  video: "aspect-video",
  square: "aspect-square md:aspect-[4/3]",
  tall: "aspect-[3/4] md:aspect-[4/3]",
};

/** Liens de repli (lecture seule, export Markdown) : http(s) uniquement, jamais javascript: */
function safeHttpUrl(raw: string) {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Fournisseurs affichés à l'auteur (PeerTube seulement si une instance est configurée) */
function providerList(peertubeHosts: string[]) {
  return (Object.keys(EMBED_LABELS) as EmbedProvider[])
    .filter((p) => p !== "peertube" || peertubeHosts.length > 0)
    .map((p) => (p === "peertube" ? `${EMBED_LABELS[p]} (${peertubeHosts.join(", ")})` : EMBED_LABELS[p]));
}

type UrlInputProps = {
  initialUrl: string;
  peertubeHosts: string[];
  onSubmit: (url: string) => void;
  onCancel?: () => void;
};

function EmbedUrlInput({ initialUrl, peertubeHosts, onSubmit, onCancel }: UrlInputProps) {
  const id = useId();
  const [value, setValue] = useState(initialUrl);
  const [error, setError] = useState<string | null>(
    initialUrl && !toEmbed(initialUrl, peertubeHosts) ? "L'adresse enregistrée n'est pas prise en charge." : null,
  );

  function apply() {
    const url = value.trim();
    if (!url) {
      setError("Collez l'adresse (https://…) du contenu à intégrer.");
      return;
    }
    if (!toEmbed(url, peertubeHosts)) {
      setError("Adresse non prise en charge : utilisez un lien https de l'un des services listés ci-dessous.");
      return;
    }
    setError(null);
    onSubmit(url);
  }

  return (
    <div contentEditable={false} className="flex w-full flex-col gap-2 border border-dashed border-line bg-sunken p-3">
      <label htmlFor={`${id}-url`} className="label">
        Adresse du contenu à intégrer
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={`${id}-url`}
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          className="input"
          placeholder="https://www.youtube.com/watch?v=…"
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-help${error ? ` ${id}-error` : ""}`}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              apply();
            }
          }}
        />
        <button type="button" className="btn btn-primary shrink-0" onClick={apply}>
          Intégrer
        </button>
        {onCancel && (
          <button type="button" className="btn shrink-0" onClick={onCancel}>
            Annuler
          </button>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="form-error">
          {error}
        </p>
      )}
      <p id={`${id}-help`} className="text-sm text-muted">
        Services pris en charge : {providerList(peertubeHosts).join(", ")}.
      </p>
    </div>
  );
}

type ViewProps = {
  url: string;
  editable: boolean;
  peertubeHosts: string[];
  onChangeUrl: (url: string) => void;
};

function EmbedView({ url, editable, peertubeHosts, onChangeUrl }: ViewProps) {
  const [editing, setEditing] = useState(false);
  const embed = url ? toEmbed(url, peertubeHosts) : null;

  if (embed && !editing) {
    const link = safeHttpUrl(url);
    return (
      <figure contentEditable={false} className="flex w-full flex-col gap-1">
        <div className={`relative w-full overflow-hidden border border-line bg-sunken ${ASPECT_CLASS[embed.aspect]}`}>
          <iframe
            src={embed.src}
            title={embed.title}
            loading="lazy"
            sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="fullscreen; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 size-full border-0"
          />
        </div>
        <figcaption className="flex flex-wrap items-center justify-between gap-x-3 text-sm text-muted">
          <span className="flex flex-wrap items-center gap-x-4">
            <span>{EMBED_LABELS[embed.provider]}</span>
            {link && (
              <a href={link} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex min-h-11 items-center underline">
                Ouvrir dans un nouvel onglet
              </a>
            )}
          </span>
          {editable && (
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(true)}>
              Modifier l&apos;adresse
            </button>
          )}
        </figcaption>
      </figure>
    );
  }

  if (!editable) {
    const link = url ? safeHttpUrl(url) : null;
    if (!link) return <div contentEditable={false} aria-hidden="true" />;
    return (
      <p contentEditable={false} className="text-sm text-muted">
        Intégration non prise en charge :{" "}
        <a href={link} target="_blank" rel="noopener noreferrer nofollow" className="break-all underline">
          {link}
        </a>
      </p>
    );
  }

  return (
    <EmbedUrlInput
      initialUrl={url}
      peertubeHosts={peertubeHosts}
      onCancel={embed ? () => setEditing(false) : undefined}
      onSubmit={(next) => {
        setEditing(false);
        onChangeUrl(next);
      }}
    />
  );
}

/**
 * Bloc « embed » (props : url) — iframe en liste blanche via toEmbed().
 * Les hôtes PeerTube sont lus côté serveur et transmis à l'éditeur (jamais process.env côté client).
 */
export function createEmbedBlock(peertubeHosts: string[]) {
  return createReactBlockSpec(
    {
      type: "embed",
      propSchema: { url: { default: "" } },
      content: "none",
    },
    {
      render: function EmbedBlockRender({ block, editor }) {
        return (
          <EmbedView
            url={block.props.url}
            editable={editor.isEditable}
            peertubeHosts={peertubeHosts}
            onChangeUrl={(url) => editor.updateBlock(block, { props: { url } })}
          />
        );
      },
      // Export HTML/Markdown (copier-coller, recherche) : un simple lien
      toExternalHTML: function EmbedBlockExport({ block }) {
        const link = block.props.url ? safeHttpUrl(block.props.url) : null;
        if (!link) return <p />;
        const embed = toEmbed(link, peertubeHosts);
        return (
          <p>
            <a href={link}>{embed ? `Intégration ${EMBED_LABELS[embed.provider]}` : link}</a>
          </p>
        );
      },
    },
  )();
}
