import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hasStructuredHtml, looksLikeMarkdown, shouldPasteAsMarkdown } from "./paste";

const COURS = `# CSS Flexbox : mettre en page

Flexbox aligne des éléments sur **un seul axe**.

## 1. Activer Flexbox

\`\`\`css
.menu { display: flex; }
\`\`\`

| Valeur | Résultat |
|---|---|
| \`row\` | en ligne |

> 💡 Astuce : centrer.

- \`gap\` plutôt que des marges
`;

describe("looksLikeMarkdown", () => {
  it("reconnaît un cours complet (titres, code, tableau, citation, listes)", () => {
    expect(looksLikeMarkdown(COURS)).toBe(true);
  });
  it("reconnaît un simple titre, un bloc de code ou un tableau", () => {
    expect(looksLikeMarkdown("## Titre\nTexte")).toBe(true);
    expect(looksLikeMarkdown("```js\nx\n```")).toBe(true);
    expect(looksLikeMarkdown("| a | b |\n|---|---|\n| 1 | 2 |")).toBe(true);
  });
  it("laisse le texte ordinaire", () => {
    expect(looksLikeMarkdown("Bonjour, ceci est une phrase.")).toBe(false);
    expect(looksLikeMarkdown("")).toBe(false);
    expect(looksLikeMarkdown("un mot # pas un titre")).toBe(false);
  });
});

describe("shouldPasteAsMarkdown", () => {
  it("convertit si le HTML est absent ou n'est que du texte en <pre>/<span> (VS Code, fichier brut)", () => {
    expect(shouldPasteAsMarkdown(COURS, "")).toBe(true);
    expect(shouldPasteAsMarkdown(COURS, "<meta charset='utf-8'><div><pre>" + COURS + "</pre></div>")).toBe(true);
  });
  it("laisse BlockNote gérer un HTML structuré (copie d'une page rendue)", () => {
    expect(hasStructuredHtml("<h1>Titre</h1><p>x</p>")).toBe(true);
    expect(shouldPasteAsMarkdown(COURS, "<h1>Titre</h1><table></table>")).toBe(false);
  });
  it("traite le fichier d'exemple fourni", () => {
    let md: string;
    try {
      md = readFileSync("/mnt/project-files/cours-exemple-flexbox.md", "utf8");
    } catch {
      return; // fichier absent en CI
    }
    expect(shouldPasteAsMarkdown(md, "")).toBe(true);
  });
});
