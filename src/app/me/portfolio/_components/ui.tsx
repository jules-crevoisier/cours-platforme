// Petits composants d'affichage sans état, partagés par le périmètre portfolio / vitrine / groupes.
import { LEVELS, levelLabel } from "@/lib/assessment";
import { LINK_STATUS_LABELS, type LinkCheckStatus } from "@/lib/link-check-core";
import { timeAgo } from "@/lib/format";

/** Lien externe (dépôt, trace, projet) : nouvel onglet, sans référent ni transmission de réputation */
export function ExternalLink({
  href,
  children,
  className = "text-accent underline break-all",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className={className}>
      {children}
      <span className="sr-only"> (s&apos;ouvre dans un nouvel onglet)</span>
    </a>
  );
}

/** Niveau 1..4 en texte (« Auto 3/4 ») ; le libellé du niveau est donné au survol et aux lecteurs d'écran */
export function LevelText({ level, who = "Auto" }: { level: number | null; who?: "Auto" | "Ens." }) {
  const whoLabel = who === "Ens." ? "Enseignant" : "Auto-positionnement";
  if (level == null) {
    return (
      <span className="text-sm whitespace-nowrap text-muted">
        <span aria-hidden="true">{who} —</span>
        <span className="sr-only">{whoLabel} : aucun</span>
      </span>
    );
  }
  return (
    <span className="text-sm whitespace-nowrap" title={levelLabel(level)}>
      <span aria-hidden="true">
        <span className="text-muted">{who}</span> {level}/4
      </span>
      <span className="sr-only">
        {whoLabel} : {level} sur 4 ({levelLabel(level)})
      </span>
    </span>
  );
}

/** Échelle des niveaux sur une ligne (« 1 Non acquis  2 En cours d'acquisition… »), à placer sous le radar */
export function LevelScale({ className = "" }: { className?: string }) {
  return (
    <dl className={`flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted ${className}`}>
      {LEVELS.map((l) => (
        <div key={l.value} className="flex gap-1.5">
          <dt className="font-semibold text-ink">{l.value}</dt>
          <dd>{l.label}</dd>
        </div>
      ))}
    </dl>
  );
}

const LINK_TONES: Record<LinkCheckStatus, string> = {
  OK: "badge-ok",
  PRIVATE: "badge-warn",
  BROKEN: "badge-danger",
  UNREACHABLE: "badge-warn",
};

/** Résultat de vérification d'un lien de dépôt : étiquette + explication + ancienneté */
export function LinkCheckStatusView({
  status,
  note,
  http,
  checkedAt,
  compact = false,
}: {
  status: LinkCheckStatus | null;
  note?: string | null;
  http?: number | null;
  checkedAt?: Date | null;
  compact?: boolean;
}) {
  if (!status) {
    return compact ? null : <span className="badge">Non vérifié</span>;
  }
  if (compact) {
    return <span className={`badge ${LINK_TONES[status]}`}>{LINK_STATUS_LABELS[status]}</span>;
  }
  return (
    <span className="flex flex-col gap-1">
      <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className={`badge ${LINK_TONES[status]}`}>{LINK_STATUS_LABELS[status]}</span>
        {http != null && <span className="text-xs text-muted">HTTP {http}</span>}
        {checkedAt && (
          <span className="text-xs text-muted">
            vérifié <time dateTime={checkedAt.toISOString()}>{timeAgo(checkedAt)}</time>
          </span>
        )}
      </span>
      {note && status !== "OK" && <span className="text-sm text-muted">{note}</span>}
    </span>
  );
}

/** Carré de couleur d'une compétence (décoratif) */
export function CompetenceDot({ color }: { color: string | null }) {
  const safe = color && /^#[0-9a-f]{3,8}$/i.test(color) ? color : null;
  return (
    <span
      aria-hidden="true"
      className="inline-block size-3 shrink-0 bg-muted"
      style={safe ? { backgroundColor: safe } : undefined}
    />
  );
}
