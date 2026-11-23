import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ReadingLayout, ReadingSection } from "@/components/app-shell/reading-layout";
import { PageHeader, StatusBadge } from "@/components/ui";

export const metadata: Metadata = { title: "Déclaration d'accessibilité" };

/*
 * Déclaration établie sur le modèle de la DINUM (accessibilite.numerique.gouv.fr).
 * Statut « non conforme » : le RGAA l'impose tant qu'aucun audit en cours de validité n'existe,
 * même si la plateforme a été conçue pour respecter les critères. À mettre à jour après l'audit
 * (statut, taux, non-conformités, environnement de test, pages auditées) — et la mention du pied de page.
 */
const DECLARATION_DATE = "23 septembre 2026";

const TOC = [
  { id: "engagement", label: "Engagement" },
  { id: "etat", label: "État de conformité" },
  { id: "contenus", label: "Contenus non accessibles" },
  { id: "etablissement", label: "Établissement de la déclaration" },
  { id: "contact", label: "Retour d'information et contact" },
  { id: "recours", label: "Voies de recours" },
];

/** Champ à renseigner par l'établissement — visible et explicite, jamais une fausse valeur */
function ToFill({ children }: { children: ReactNode }) {
  return (
    <span className="bg-warn-soft px-1.5 py-0.5 text-warn">
      <span className="font-semibold">À compléter :</span> {children}
    </span>
  );
}

function Bullets({ children }: { children: ReactNode }) {
  return <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-line-strong">{children}</ul>;
}

export default function AccessibilityPage() {
  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title="Déclaration d'accessibilité"
        meta={
          <>
            <span>RGAA 4.1</span>
            <span>WCAG 2.1 AA</span>
            <span>Établie le {DECLARATION_DATE}</span>
            <span>Statut : non conforme (audit à réaliser)</span>
          </>
        }
      />

      <p role="note">
        <StatusBadge tone="warn">Déclaration provisoire</StatusBadge>
      </p>

      <ReadingLayout toc={TOC}>
        <ReadingSection id="engagement" title="Engagement">
          <p>
            <ToFill>nom de l&apos;université et de l&apos;IUT</ToFill> s&apos;engage à rendre ses sites internet,
            intranet, extranet et ses progiciels accessibles, conformément à l&apos;article 47 de la loi n° 2005-102
            du 11 février 2005.
          </p>
          <p>
            Cette déclaration d&apos;accessibilité s&apos;applique à la plateforme « Cours &amp; SAÉ » du département
            MMI (cours, SAÉ, jalons, auto-évaluations, portfolio et vitrine).
          </p>
        </ReadingSection>

        <ReadingSection id="etat" title="État de conformité">
          <p>
            La plateforme Cours &amp; SAÉ est <strong>non conforme</strong> avec le référentiel général
            d&apos;amélioration de l&apos;accessibilité (RGAA), version 4.1 : <strong>aucun audit n&apos;a encore
            été réalisé</strong>.
          </p>
          <p>
            Sans résultat d&apos;audit en cours de validité, le RGAA impose ce statut, même lorsque le service a été
            conçu pour respecter les critères. Il sera mis à jour après l&apos;audit, avec le taux de conformité
            mesuré.
          </p>
          <p>Mesures prises dès la conception (non encore vérifiées par un audit) :</p>
          <Bullets>
            <li>contrastes de texte d&apos;au moins 4,5:1, en thème clair comme en thème sombre ;</li>
            <li>navigation complète au clavier, focus toujours visible, lien « Aller au contenu » ;</li>
            <li>libellés visibles sur tous les champs, messages d&apos;erreur en texte ;</li>
            <li>aucune information portée par la seule couleur (statuts et échéances ont un libellé) ;</li>
            <li>zones cliquables d&apos;au moins 44 px sur écran tactile, affichage lisible dès 320 px de large ;</li>
            <li>animations réduites au minimum et coupées si le système demande de limiter les mouvements.</li>
          </Bullets>
        </ReadingSection>

        <ReadingSection id="contenus" title="Contenus non accessibles">
          <h3 className="text-lg">Non-conformités</h3>
          <p>
            <ToFill>liste issue de l&apos;audit</ToFill>
          </p>
          <p>Points de vigilance déjà identifiés :</p>
          <Bullets>
            <li>
              l&apos;éditeur de contenu par blocs (bibliothèque BlockNote) : le déplacement d&apos;un bloc par sa
              poignée se fait à la souris ; au clavier, couper puis coller le bloc permet de le déplacer ;
            </li>
            <li>
              les contenus intégrés depuis des services tiers (vidéos, prototypes) dépendent de l&apos;accessibilité
              de ces services.
            </li>
          </Bullets>
          <h3 className="text-lg">Dérogations pour charge disproportionnée</h3>
          <p>Aucune.</p>
          <h3 className="text-lg">Contenus non soumis à l&apos;obligation d&apos;accessibilité</h3>
          <p>
            Les travaux déposés par les étudiants sous forme de liens externes (Google Drive, Figma, GitHub…) : ils
            ne sont ni développés ni contrôlés par l&apos;établissement.
          </p>
        </ReadingSection>

        <ReadingSection id="etablissement" title="Établissement de cette déclaration">
          <p>Cette déclaration a été établie le {DECLARATION_DATE}.</p>
          <dl className="flex flex-col divide-y divide-line border-y border-line">
            <div className="flex flex-col gap-1 py-3">
              <dt className="font-semibold">Technologies utilisées</dt>
              <dd className="text-muted">HTML5, CSS, JavaScript (React, Next.js), WAI-ARIA, SVG.</dd>
            </div>
            <div className="flex flex-col gap-1 py-3">
              <dt className="font-semibold">Environnement de test</dt>
              <dd>
                <ToFill>
                  combinaisons navigateur et technologie d&apos;assistance de l&apos;audit (par exemple NVDA et
                  Firefox, VoiceOver et Safari)
                </ToFill>
              </dd>
            </div>
            <div className="flex flex-col gap-1 py-3">
              <dt className="font-semibold">Outils d&apos;évaluation</dt>
              <dd>
                <ToFill>outils utilisés lors de l&apos;audit</ToFill>
              </dd>
            </div>
            <div className="flex flex-col gap-1 py-3">
              <dt className="font-semibold">Pages ayant fait l&apos;objet de la vérification</dt>
              <dd className="flex flex-col gap-2">
                <ToFill>échantillon audité</ToFill>
                <span className="text-muted">
                  Échantillon proposé : accueil, connexion, liste des cours, page de cours, SAÉ, jalon,
                  auto-évaluation, portfolio, aide, présente déclaration.
                </span>
              </dd>
            </div>
          </dl>
        </ReadingSection>

        <ReadingSection id="contact" title="Retour d'information et contact">
          <p>
            Si vous n&apos;arrivez pas à accéder à un contenu ou à un service, contactez le responsable de la
            plateforme : vous serez orienté vers une alternative accessible ou recevrez le contenu sous une autre
            forme.
          </p>
          <dl className="flex flex-col divide-y divide-line border-y border-line">
            <div className="flex flex-col gap-1 py-3">
              <dt className="font-semibold">E-mail</dt>
              <dd>
                <ToFill>adresse du référent accessibilité</ToFill>
              </dd>
            </div>
            <div className="flex flex-col gap-1 py-3">
              <dt className="font-semibold">Adresse postale</dt>
              <dd>
                <ToFill>adresse du département MMI</ToFill>
              </dd>
            </div>
          </dl>
          <p>En attendant, signalez le problème à votre enseignant référent : il peut vous transmettre le contenu.</p>
        </ReadingSection>

        <ReadingSection id="recours" title="Voies de recours">
          <p>
            Si vous avez signalé un défaut d&apos;accessibilité qui vous empêche d&apos;accéder à un contenu ou à un
            service de la plateforme, et que vous n&apos;avez pas obtenu de réponse satisfaisante, vous pouvez saisir
            le Défenseur des droits :
          </p>
          <Bullets>
            <li>
              <a href="https://www.defenseurdesdroits.fr/nous-contacter-355" className="link">
                écrire un message au Défenseur des droits
              </a>{" "}
              ;
            </li>
            <li>
              <a href="https://www.defenseurdesdroits.fr/carte-des-delegues" className="link">
                contacter le délégué du Défenseur des droits près de chez vous
              </a>{" "}
              ;
            </li>
            <li>
              envoyer un courrier par la poste (gratuit, sans timbre) : Défenseur des droits, Libre réponse 71120,
              75342 Paris CEDEX 07.
            </li>
          </Bullets>
        </ReadingSection>
      </ReadingLayout>
    </div>
  );
}
