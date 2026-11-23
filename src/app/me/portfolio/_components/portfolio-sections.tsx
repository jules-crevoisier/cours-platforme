// Portfolio regroupé par compétence → AC : traces personnelles + traces issues des SAÉ.
// Composant serveur partagé par /me/portfolio (propriétaire), /students/[userId] (équipe) et /p/portfolio (public).
// Toujours placé sous un titre h2 de la page : compétences en h3, AC en h4, rubriques en h5 (petits titres).
import Link from "next/link";
import { EmptyState } from "@/components/ui";
import { PROVIDER_LABELS } from "@/lib/deposit";
import { formatDate } from "@/lib/format";
import type { EvidenceRow, Portfolio, SaeTrace } from "../_lib/profile";
import { CompetenceDot, ExternalLink, LevelText, LinkCheckStatusView } from "./ui";

type Props = {
  portfolio: Portfolio;
  /** public : ni niveaux enseignant, ni lien vers les auto-évaluations, ni état des liens */
  mode: "owner" | "staff" | "public";
  /** Afficher les traces issues des SAÉ (masquées quand la page les présente déjà ailleurs) */
  saeTraces?: boolean;
  /** Lien vers l'auto-évaluation autorisé pour cette trace ? */
  canOpenAssessment?: (trace: SaeTrace) => boolean;
  /** Contrôles d'édition d'une trace (propriétaire uniquement) */
  renderEvidenceActions?: (evidence: EvidenceRow) => React.ReactNode;
  emptyMessage: React.ReactNode;
};

export function PortfolioSections({
  portfolio,
  mode,
  saeTraces = true,
  canOpenAssessment,
  renderEvidenceActions,
  emptyMessage,
}: Props) {
  const isPublic = mode === "public";
  const tracesOf = (learningId: string) => (saeTraces ? (portfolio.tracesByLearning.get(learningId) ?? []) : []);
  const competences = portfolio.referentiel
    .map((c) => ({
      ...c,
      learnings: c.learnings.filter(
        (l) => portfolio.evidencesByLearning.has(l.id) || tracesOf(l.id).length > 0,
      ),
    }))
    .filter((c) => c.learnings.length > 0);

  if (competences.length === 0) {
    return <EmptyState>{emptyMessage}</EmptyState>;
  }

  return (
    <div className="flex flex-col gap-8">
      {competences.map((c) => (
        <section key={c.id} aria-labelledby={`pf-${c.code}`} className="flex flex-col gap-2">
          <h3 id={`pf-${c.code}`} className="flex flex-wrap items-center gap-2 text-lg">
            <CompetenceDot color={c.color} />
            <span>{c.code}</span>
            <span>{c.name}</span>
          </h3>

          <ul className="flex flex-col divide-y divide-line">
            {c.learnings.map((l) => {
              const evidences = portfolio.evidencesByLearning.get(l.id) ?? [];
              const traces = tracesOf(l.id);
              const latest = portfolio.latestByLearning.get(l.id);
              return (
                <li key={l.id} id={`ac-${l.code}`} className="flex flex-col gap-4 py-4 print:break-inside-avoid">
                  <div className="flex flex-col gap-1">
                    <h4 className="text-base">{l.code}</h4>
                    <p className="text-sm">{l.label}</p>
                    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                      <span>Niveau {l.level}</span>
                      {l.parcours && <span>Parcours {l.parcours}</span>}
                      <LevelText level={latest?.self?.level ?? null} />
                      {!isPublic && <LevelText level={latest?.teacher?.level ?? null} who="Ens." />}
                    </p>
                  </div>

                  {evidences.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <h5 className="text-sm font-semibold">Traces personnelles</h5>
                      <ul className="flex flex-col divide-y divide-line">
                        {evidences.map((e) => (
                          <li key={e.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                              <p className="font-medium break-words">
                                {e.url ? (
                                  <ExternalLink href={e.url} className="text-accent underline break-words">
                                    {e.title}
                                  </ExternalLink>
                                ) : (
                                  e.title
                                )}
                              </p>
                              <LevelText level={e.level} />
                              <span className="text-sm text-muted">
                                <time dateTime={e.updatedAt.toISOString()}>{formatDate(e.updatedAt)}</time>
                              </span>
                            </div>
                            {/* Sur papier, le lien n'est pas cliquable : on l'écrit en clair */}
                            {e.url && <p className="hidden font-mono text-xs break-all print:block">{e.url}</p>}
                            {e.reflection && (
                              <p className="max-w-prose text-sm whitespace-pre-line">{e.reflection}</p>
                            )}
                            {renderEvidenceActions?.(e)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {traces.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <h5 className="text-sm font-semibold">Traces de SAÉ</h5>
                      <ul className="flex flex-col divide-y divide-line">
                        {traces.map((t) => (
                          <li key={t.key} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                            <p className="font-medium break-words">{t.milestoneTitle}</p>
                            <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                              <span>{t.saeCode ? `${t.saeCode} ${t.saeTitle}` : t.saeTitle}</span>
                              <span>{t.criterionLabel}</span>
                            </p>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                              <LevelText level={t.selfLevel} />
                              {!isPublic && <LevelText level={t.teacherLevel} who="Ens." />}
                              <span className="text-sm text-muted">
                                <time dateTime={t.submittedAt.toISOString()}>{formatDate(t.submittedAt)}</time>
                              </span>
                              {!isPublic && canOpenAssessment?.(t) && (
                                <Link
                                  href={`/assessments/${t.assessmentId}`}
                                  className="inline-flex min-h-11 items-center text-sm text-accent underline print:hidden"
                                >
                                  Voir l&apos;auto-évaluation
                                </Link>
                              )}
                            </div>
                            {t.links.length > 0 && (
                              <ul className="flex flex-col gap-1">
                                {t.links.map((link) => (
                                  <li key={link.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                                    <span className="text-muted">{PROVIDER_LABELS[link.provider]}</span>
                                    <ExternalLink href={link.url}>{link.label ?? link.url}</ExternalLink>
                                    {!isPublic && <LinkCheckStatusView status={link.checkStatus} compact />}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
