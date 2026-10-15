# Import depuis BookStack

Script : `scripts/import-bookstack.ts` (logique pure et testée dans `src/lib/bookstack-import.ts`).
Il crée, en **brouillon**, un cours par livre (chapitres et pages en arbre de pages) et une SAÉ pour les livres SAÉ
(un jalon par chapitre « SEMAINE… »). Simulation par défaut ; `--apply --owner <email>` pour écrire.

## Sans droit admin (cas de docs.mmi-troyes.fr)

1. Pour chaque livre : *Exporter → Fichiers web* ; enregistrer le `.html` dans un dossier (le nom du fichier sans
   extension devient le slug du cours). Sur certains serveurs le ZIP renvoie une erreur 500 : utiliser le HTML.
2. Les exports HTML intègrent les images en base64 sans leur URL. Pour les conserver, récupérer le contenu en ligne
   des pages (`/link/<idPage>` → `.page-content`, URL d'images absolues) dans un JSON `{ "<idPage>": "<html>" }`
   et le passer avec `--live-pages`.
3. `npx tsx scripts/import-bookstack.ts --from-html ./exports --live-pages ./pages.json --owner prof@univ.fr`
   (ajouter `--apply` après avoir relu la simulation).

Attention : le serveur limite les exports (HTTP 429) : espacer d'une vingtaine de secondes.

## Avec jeton d'API (droit admin BookStack)

`BOOKSTACK_URL=… BOOKSTACK_TOKEN_ID=… BOOKSTACK_TOKEN_SECRET=… npx tsx scripts/import-bookstack.ts --owner … [--apply]`

## Règles et limites

- Seule la version la plus récente d'un même cours est importée ([25/26] vs [26/27]) ; BACKUP / OLD / Test sont
  ignorés (`--include-archived` pour les garder). Relire la liste des « ignorés » de la simulation.
- Tableaux → tableaux Markdown ; iframes https → lien « Intégration » ; scripts supprimés ; liens non http(s) retirés.
- Les images pointent vers le BookStack d'origine : elles disparaissent avec lui (la plateforme ne stocke pas de fichiers).
- Idempotent : un cours dont le slug existe déjà est laissé intact.
- Après import : vue `/saes?filtre=a-completer` pour les SAÉ sans jalons, dates ou AC ; publication groupée dans `/courses`.
