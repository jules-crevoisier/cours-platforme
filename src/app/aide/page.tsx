import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ReadingLayout, ReadingSection } from "@/components/app-shell/reading-layout";
import { PageHeader } from "@/components/ui";
import { MMI_COMPETENCES, MMI_CRITICAL_LEARNINGS, MMI_PARCOURS } from "@/data/referentiel-mmi";
import { CONTRIBUTION_LEVELS, LEVELS } from "@/lib/assessment";

export const metadata: Metadata = { title: "Aide" };

const TOC = [
  { id: "referentiel", label: "Lire le référentiel" },
  { id: "auto-evaluation", label: "S'auto-positionner" },
  { id: "depot", label: "Déposer une URL publique" },
  { id: "agenda", label: "Abonner son agenda" },
  { id: "editeur", label: "Écrire dans l'éditeur" },
  { id: "enseignants", label: "Pour les enseignants" },
];

/** Touche du clavier : texte gras, police de l'interface (le navigateur met <kbd> en mono par défaut) */
function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="font-sans font-semibold text-ink">{children}</kbd>;
}

const CODE_FENCE = "```";

const SHORTCUTS: { keys: ReactNode; does: string }[] = [
  { keys: <Kbd>/</Kbd>, does: "Menu des blocs : titre, liste, tableau, image, code…" },
  {
    keys: (
      <>
        <Kbd>#</Kbd> <Kbd>##</Kbd> <Kbd>###</Kbd> + espace
      </>
    ),
    does: "Titre de niveau 1, 2 ou 3",
  },
  {
    keys: (
      <>
        <Kbd>-</Kbd> + espace
      </>
    ),
    does: "Liste à puces",
  },
  {
    keys: (
      <>
        <Kbd>1.</Kbd> + espace
      </>
    ),
    does: "Liste numérotée",
  },
  {
    keys: (
      <>
        <Kbd>&gt;</Kbd> + espace
      </>
    ),
    does: "Citation",
  },
  { keys: <Kbd>{CODE_FENCE}</Kbd>, does: "Bloc de code" },
  {
    keys: (
      <>
        <Kbd>Ctrl</Kbd> ou <Kbd>⌘</Kbd> + <Kbd>B</Kbd> <Kbd>I</Kbd> <Kbd>U</Kbd>
      </>
    ),
    does: "Gras, italique, souligné",
  },
  {
    keys: (
      <>
        <Kbd>Ctrl</Kbd> ou <Kbd>⌘</Kbd> + <Kbd>Z</Kbd>
      </>
    ),
    does: "Annuler (avec Maj : rétablir)",
  },
  {
    keys: (
      <>
        <Kbd>Tab</Kbd> / <Kbd>Maj</Kbd> + <Kbd>Tab</Kbd>
      </>
    ),
    does: "Indenter / désindenter un élément de liste",
  },
  { keys: "Coller du Markdown", does: "Converti en blocs" },
];

const DEPOSIT_TIPS = [
  {
    t: "Google Drive, Docs, Slides",
    d: "Partager → « Tous les utilisateurs disposant du lien », rôle « Lecteur » → Copier le lien.",
  },
  { t: "Figma", d: "Share → « Anyone with the link » → « can view » → Copy link (mode présentation pour un prototype)." },
  {
    t: "GitHub",
    d: "Dépôt public, ou privé avec vos enseignants en collaborateurs. Pour un site en ligne, déposez aussi l'URL publiée.",
  },
  { t: "OneDrive, SharePoint", d: "Partager → « Toute personne disposant du lien », en affichage seul." },
  { t: "Vidéo (YouTube, PeerTube)", d: "« Non répertoriée », pas « Privée »." },
];

const CALENDAR_TIPS = [
  { t: "Google Agenda (ordinateur)", d: "« Autres agendas » → « + » → « À partir de l'URL »." },
  { t: "Apple Calendrier (Mac)", d: "Fichier → « Nouvel abonnement à un calendrier… »." },
  { t: "iPhone, iPad", d: "Réglages → Calendrier → Comptes → Ajouter un compte → Autre → « Ajouter un calendrier avec abonnement »." },
  { t: "Outlook", d: "« Ajouter un calendrier » → « S'abonner à partir du web »." },
];

function TipList({ rows }: { rows: { t: string; d: string }[] }) {
  return (
    <dl className="flex flex-col divide-y divide-line border-y border-line">
      {rows.map((row) => (
        <div key={row.t} className="flex flex-col gap-1 py-3">
          <dt className="font-semibold">{row.t}</dt>
          <dd className="text-muted">{row.d}</dd>
        </div>
      ))}
    </dl>
  );
}

function Bullets({ children }: { children: ReactNode }) {
  return <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-line-strong">{children}</ul>;
}

export default function HelpPage() {
  const c4 = MMI_COMPETENCES.find((c) => c.code === "C4");
  const ac = MMI_CRITICAL_LEARNINGS.find((l) => l.code === "AC14.02");
  const firstLevel = LEVELS[0];
  const secondLevel = LEVELS[1];

  return (
    <div className="flex flex-col gap-10">
      <PageHeader title="Aide" />

      <ReadingLayout toc={TOC}>
        <ReadingSection id="referentiel" title="Lire le référentiel">
          <p>
            Le BUT MMI compte {MMI_COMPETENCES.length} compétences, chacune découpée en niveaux (environ une année
            chacun), puis en apprentissages critiques (AC), {MMI_CRITICAL_LEARNINGS.length} au total. Les SAÉ font
            travailler les AC ; vous vous positionnez sur eux.
          </p>
          <ul className="flex flex-col divide-y divide-line border-y border-line">
            {MMI_COMPETENCES.map((c) => (
              <li key={c.code} className="flex flex-col gap-1 py-3">
                <span>
                  <strong>{c.code}</strong> {c.name}
                </span>
                <span className="text-muted">{c.description}</span>
              </li>
            ))}
          </ul>
          {c4 && ac && (
            <p>
              Un code d&apos;AC se lit chiffre par chiffre : <strong>{ac.code}</strong> = niveau 1, compétence 4 (
              {c4.name}), apprentissage n° 02.
            </p>
          )}
          <p>À partir de la deuxième année, le parcours détermine les compétences approfondies :</p>
          <Bullets>
            {MMI_PARCOURS.map((p) => (
              <li key={p.code}>
                {p.name} : {p.competences.join(" et ")}
              </li>
            ))}
          </Bullets>
          <p>
            Votre progression :{" "}
            <Link href="/me/competences" className="link">
              Mes compétences
            </Link>
            .
          </p>
        </ReadingSection>

        <ReadingSection id="auto-evaluation" title="S'auto-positionner">
          <p>À chaque jalon, vous vous situez sur chaque critère :</p>
          <ol className="flex flex-col divide-y divide-line border-y border-line">
            {LEVELS.map((l) => (
              <li key={l.value} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 py-3">
                <span className="font-semibold">{l.value}</span>
                <span className="flex flex-col">
                  <span className="font-semibold">{l.label}</span>
                  <span className="text-muted">« {l.hint} »</span>
                </span>
              </li>
            ))}
          </ol>
          <Bullets>
            <li>Ce que vous savez faire aujourd&apos;hui, pas ce que le groupe a produit.</li>
            <li>Une trace vérifiable par niveau : un commit, un écran de maquette, un retour utilisateur.</li>
            <li>
              « {secondLevel.label} » n&apos;est pas une mauvaise note ; « {firstLevel.label} » est une information
              utile.
            </li>
            <li>L&apos;enseignant se positionne sur les mêmes critères ; son retour est visible une fois publié.</li>
            <li>Brouillon autant que nécessaire ; une fois soumise, seule l&apos;équipe pédagogique peut la rouvrir.</li>
          </Bullets>
          <p>
            Évaluation entre pairs (si le jalon la prévoit) : de « {CONTRIBUTION_LEVELS[0].label} » à «{" "}
            {CONTRIBUTION_LEVELS[CONTRIBUTION_LEVELS.length - 1].label} ». Seule l&apos;équipe pédagogique voit qui a
            noté quoi.
          </p>
        </ReadingSection>

        <ReadingSection id="depot" title="Déposer une URL publique">
          <p>
            Vous déposez un lien (http ou https), pas un fichier. Il doit s&apos;ouvrir sans compte : vérifiez-le dans
            une fenêtre de navigation privée.
          </p>
          <TipList rows={DEPOSIT_TIPS} />
          <p>Les statuts « Privé / connexion requise » et « Lien cassé » signalent un lien qui ne s&apos;ouvrira pas.</p>
        </ReadingSection>

        <ReadingSection id="agenda" title="Abonner son agenda">
          <p>
            <Link href="/me/settings" className="link">
              Paramètres
            </Link>{" "}
            fournit un lien d&apos;abonnement personnel : jalons et créneaux de soutenance dans votre agenda habituel.
          </p>
          <TipList rows={CALENDAR_TIPS} />
          <p>
            La mise à jour peut prendre plusieurs heures. Si le lien a circulé, créez-en un nouveau : l&apos;ancien
            cesse de fonctionner.
          </p>
        </ReadingSection>

        <ReadingSection id="editeur" title="Écrire dans l'éditeur">
          <p>Le Markdown est reconnu à la frappe et au collage. L&apos;enregistrement est automatique.</p>
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Raccourcis de l&apos;éditeur</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="py-2 pr-4 text-sm font-semibold text-muted">
                  Saisir
                </th>
                <th scope="col" className="py-2 text-sm font-semibold text-muted">
                  Résultat
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {SHORTCUTS.map((s) => (
                <tr key={s.does} className="align-top">
                  <td className="py-2.5 pr-4 text-sm">{s.keys}</td>
                  <td className="py-2.5">{s.does}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>Pour déplacer un bloc : la poignée à sa gauche, ou couper puis coller.</p>
        </ReadingSection>

        <ReadingSection id="enseignants" title="Pour les enseignants">
          <Bullets>
            <li>Créez la SAÉ, ses jalons datés, et rattachez chaque critère à un AC du référentiel.</li>
            <li>Ajoutez les étudiants aux groupes par adresse e-mail (une liste collée suffit).</li>
            <li>Votre retour sur une auto-évaluation reste un brouillon jusqu&apos;à sa publication.</li>
            <li>
              La{" "}
              <Link href="/me/comment-bank" className="link">
                banque de commentaires
              </Link>{" "}
              garde vos formulations récurrentes.
            </li>
            <li>L&apos;accueil liste ce qui attend une action : retours, demandes de vitrine, questions.</li>
          </Bullets>
        </ReadingSection>
      </ReadingLayout>
    </div>
  );
}
