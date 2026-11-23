# Design — simple, carré, lisible

**Principe.** Un outil de travail qu'on comprend sans lire de mode d'emploi. Chaque page a un titre, son contenu
et une ou deux actions. Ce qui ne sert pas à agir ou à lire le cours n'est pas affiché.

## Règles (non négociables)
1. **Tout est carré** : aucun arrondi (les tokens `--radius-*` valent 0 ; ne pas ajouter de `rounded-full`).
2. **Une seule police** : Archivo (variable, `next/font`). Titres en 700 élargis (`font-stretch: 112%`).
   Pas de police mono, sauf pour du vrai code ou une URL à copier (`font-mono` = mono système).
3. **Un seul accent** : bleu électrique `--accent`, pour l'action principale, l'élément actif et les liens.
   Jamais pour un statut.
4. **Pas de surtitre** au-dessus des titres, pas de capitales espacées, pas de numérotation décorative (01, 02…).
5. **Pas de phrase d'explication** sous un titre ou dans une section. Au plus une ligne factuelle (dates, groupe).
   Les états vides tiennent en une ligne (« Aucun jalon. ») + un bouton si une action existe.
6. **Pas de « · »** pour coller des informations : une info par élément, mise en page avec des espaces.
7. **Un badge maximum par ligne.** Un badge = un carré de couleur + un mot (`.badge`, `StatusBadge`).
8. **Une action n'apparaît qu'une fois** par page. Pas de lien en double vers la même destination.

## Couleurs (tokens dans `globals.css`, jamais de valeur en dur)
| Token | Clair | Usage |
|---|---|---|
| `--bg` / `--surface` | #FFFFFF | fond, cartes |
| `--sunken` | #F4F4F3 | barre latérale, survols |
| `--ink` | #111111 | texte |
| `--muted` | #5E5E5B | texte secondaire |
| `--line` / `--line-strong` | #E6E6E3 / #7D7D79 | filets / bords des champs |
| `--accent` | #2244FF | action, actif, lien |
| `--ok` `--warn` `--danger` (+ `-soft`) | vert / ambre / rouge | statuts uniquement |

Thème clair par défaut. Le thème sombre existe (`[data-theme="dark"]`), il s'active depuis le menu du compte
(cookie `theme`) ; le réglage du système n'est pas suivi.

## Mise en page
- **≥ 1024 px** : barre latérale 240 px — logo, cloche, recherche (Ctrl K), Accueil · Cours · SAÉ · Vitrine,
  puis Enseignement / Administration selon le rôle, favoris s'il y en a, menu du compte en bas.
- **< 1024 px** : barre haute (logo, recherche, cloche, menu) + barre d'onglets basse (4 entrées).
- **En-tête de page** : `PageHeader` partout — fil d'Ariane, titre, actions (+ une ligne `meta` factuelle au besoin).
- **Sections** : un `h2` (`text-xl`), du contenu, pas de trait sous le titre. Espacement entre sections : `gap-10`.
- **Listes** plutôt que cartes ; cartes (`.card`) pour les cours, SAÉ et projets de la vitrine, avec `Swatch`.
- **Pages de gestion** découpées en onglets (`Tabs`), jamais une longue page de formulaires.
- Boutons : 44 px au tactile, 40 px à la souris. Survol d'un bouton = inversion encre / fond.

## Composants (`src/components/ui/`)
`PageHeader` + `Breadcrumbs` · `EmptyState` (une ligne + action) · `StatusBadge` / `AssessmentStatusBadge` ·
`DeadlineChip` (une seule info : « Demain », « Dans 3 jours », puis la date) · `MilestoneSteps` (frise des jalons) ·
`Tabs` · `Swatch` (carré de couleur + initiales, stable par identifiant) · `Icon` (trait, angles droits).

## Vocabulaire
Paramètres (pas Réglages) · Mon profil · Auto-évaluation « Non commencée / Brouillon / Soumise » ·
Évaluation entre pairs · Pagination « Précédent / Suivant » · Filtre « Filtrer / Effacer ».

## Accessibilité (RGAA 4.1 / WCAG 2.1 AA — obligation légale)
Contrastes AA, focus visible 2 px accent, labels visibles, `aria-live` pour les enregistrements, jamais la couleur
seule, navigation clavier complète, mention « Accessibilité : non conforme » en pied de page (lien vers la déclaration).
