import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { isTokenShape } from "@/lib/tokens";
import { PageHeader } from "@/components/ui";
import { CompetenceRadar } from "@/components/competence-radar";
import { loadPortfolio } from "@/app/me/portfolio/_lib/profile";
import { PortfolioSections } from "@/app/me/portfolio/_components/portfolio-sections";
import { PrintButton } from "@/app/me/portfolio/_components/share-tools";
import { LevelScale } from "@/app/me/portfolio/_components/ui";

// Lien secret : jamais indexé, jamais de référent transmis aux liens sortants
export const metadata: Metadata = {
  title: "Portfolio de compétences",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

export default async function PublicPortfolioPage({ params }: PageProps<"/p/portfolio/[token]">) {
  const { token } = await params;
  if (!isTokenShape(token)) notFound();

  const owner = await db.user.findUnique({
    where: { portfolioToken: token },
    select: { id: true, name: true },
  });
  if (!owner) notFound();

  // Uniquement le contenu de l'étudiant : auto-positionnements et traces (pas de niveaux ni commentaires enseignants)
  const portfolio = await loadPortfolio(owner.id, { includeTeacher: false, publicView: true });

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title={owner.name}
        meta={<span>Portfolio de compétences BUT MMI</span>}
        actions={<PrintButton />}
      />

      <section aria-labelledby="public-radar-title" className="flex flex-col gap-4">
        <h2 id="public-radar-title" className="text-xl">
          Auto-positionnement
        </h2>
        <div className="flex max-w-xl flex-col gap-4">
          <CompetenceRadar
            id="public-radar"
            scores={portfolio.scores}
            showTeacher={false}
            title={`Auto-positionnement de ${owner.name}`}
          />
          <LevelScale />
        </div>
      </section>

      <section aria-labelledby="public-traces-title" className="flex flex-col gap-4">
        <h2 id="public-traces-title" className="text-xl">
          Traces
        </h2>
        <PortfolioSections portfolio={portfolio} mode="public" emptyMessage="Aucune trace." />
      </section>
    </div>
  );
}
