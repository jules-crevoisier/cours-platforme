import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { isStaff } from "@/lib/permissions";
import { EmptyState, PageHeader } from "@/components/ui";
import { loadPortfolio } from "./_lib/profile";
import { ActionButton } from "./_components/action-button";
import { EvidenceForm, type LearningOptionGroup } from "./_components/evidence-form";
import { PortfolioSections } from "./_components/portfolio-sections";
import { CopyField, PrintButton } from "./_components/share-tools";
import { deleteEvidence, disablePortfolioShare, enablePortfolioShare, saveEvidence } from "./actions";

export const metadata: Metadata = { title: "Mon portfolio" };

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PortfolioPage({ searchParams }: PageProps<"/me/portfolio">) {
  const user = await requireUser();
  // Le portfolio concerne les étudiants : l'équipe pédagogique consulte celui des étudiants depuis /students
  if (isStaff(user)) redirect("/students");

  const sp = await searchParams;
  const acCode = one(sp.ac);

  const [portfolio, me] = await Promise.all([
    loadPortfolio(user.id, { includeTeacher: true }),
    db.user.findUnique({ where: { id: user.id }, select: { portfolioToken: true } }),
  ]);

  // Options du sélecteur d'AC, groupées par compétence puis niveau
  const groupsByCompetence = new Map<string, LearningOptionGroup[]>();
  const competenceOfLearning = new Map<string, string>();
  for (const c of portfolio.referentiel) {
    groupsByCompetence.set(
      c.code,
      [1, 2, 3]
        .map((level) => ({
          label: `${c.code} ${c.name} — niveau ${level}`,
          options: c.learnings
            .filter((l) => l.level === level)
            .map((l) => ({ id: l.id, code: l.code, label: l.label })),
        }))
        .filter((g) => g.options.length > 0),
    );
    for (const l of c.learnings) competenceOfLearning.set(l.id, c.code);
  }
  const groups = [...groupsByCompetence.values()].flat();
  // En modification, on propose les AC de la même compétence (formulaires plus légers)
  const groupsFor = (learningId: string) => groupsByCompetence.get(competenceOfLearning.get(learningId) ?? "") ?? groups;
  const defaultLearningId = acCode
    ? portfolio.referentiel.flatMap((c) => c.learnings).find((l) => l.code === acCode)?.id
    : undefined;

  const token = me?.portfolioToken ?? null;
  const base = (process.env.BETTER_AUTH_URL ?? "").replace(/\/+$/, "");
  const sharePath = token ? `/p/portfolio/${token}` : null;
  const shareUrl = sharePath ? `${base}${sharePath}` : null;

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title="Mon portfolio"
        actions={
          <>
            <Link href="/me/competences" className="btn print:hidden">
              Mes compétences
            </Link>
            <PrintButton />
          </>
        }
      />

      <section aria-labelledby="share-title" className="flex flex-col gap-3 print:hidden">
        <h2 id="share-title" className="text-xl">
          Partage
        </h2>
        <p className="text-sm text-muted">
          Le lien public montre vos traces et votre auto-positionnement, jamais les avis des enseignants.
        </p>
        {token && sharePath && shareUrl ? (
          <>
            <CopyField id="share-url" label="Lien public" value={shareUrl}>
              <Link href={sharePath} className="btn btn-ghost" target="_blank" rel="noopener noreferrer">
                Aperçu
                <span className="sr-only"> du portfolio public (s&apos;ouvre dans un nouvel onglet)</span>
              </Link>
            </CopyField>
            <details>
              <summary className="btn btn-ghost cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                Plus d&apos;options
              </summary>
              <div className="mt-3 flex flex-wrap items-start gap-2">
                <ActionButton
                  action={enablePortfolioShare}
                  label="Renouveler le lien"
                  pendingLabel="Renouvellement…"
                  confirmMessage="Créer un nouveau lien ? L'ancien lien cessera immédiatement de fonctionner."
                  showSuccess
                />
                <ActionButton
                  action={disablePortfolioShare}
                  label="Désactiver le lien"
                  pendingLabel="Désactivation…"
                  confirmMessage="Désactiver le lien public ? Le portfolio redeviendra privé."
                  variant="danger"
                  showSuccess
                />
              </div>
            </details>
          </>
        ) : (
          <ActionButton
            action={enablePortfolioShare}
            label="Créer un lien public"
            pendingLabel="Création…"
            showSuccess
          />
        )}
      </section>

      <section aria-labelledby="evidences-title" className="flex flex-col gap-4">
        <h2 id="evidences-title" className="text-xl">
          Traces
        </h2>
        {groups.length === 0 ? (
          <EmptyState>Référentiel de compétences non chargé.</EmptyState>
        ) : (
          // Déplié quand on arrive depuis « Ajouter une trace » (/me/competences, ?ac=…)
          <details id="nouvelle-trace" open={!!defaultLearningId} className="print:hidden">
            <summary className="btn btn-primary cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              Ajouter une trace
            </summary>
            <div className="mt-4 max-w-3xl border border-line p-4 md:p-5">
              <EvidenceForm action={saveEvidence} groups={groups} defaultLearningId={defaultLearningId} />
            </div>
          </details>
        )}
        <PortfolioSections
          portfolio={portfolio}
          mode="owner"
          canOpenAssessment={() => true}
          emptyMessage="Aucune trace."
          renderEvidenceActions={(e) => (
            <details className="print:hidden">
              <summary className="btn btn-ghost cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                Modifier<span className="sr-only"> la trace {e.title}</span>
              </summary>
              <div className="mt-3 flex max-w-3xl flex-col gap-4 border border-line p-4">
                <EvidenceForm
                  action={saveEvidence}
                  groups={groupsFor(e.learningId)}
                  initial={{
                    id: e.id,
                    learningId: e.learningId,
                    title: e.title,
                    url: e.url ?? "",
                    reflection: e.reflection ?? "",
                    level: e.level,
                  }}
                />
                <ActionButton
                  action={deleteEvidence.bind(null, e.id)}
                  label="Supprimer la trace"
                  pendingLabel="Suppression…"
                  confirmMessage={`Supprimer la trace « ${e.title} » ?`}
                  ariaLabel={`Supprimer la trace ${e.title}`}
                  variant="danger"
                />
              </div>
            </details>
          )}
        />
      </section>
    </div>
  );
}
