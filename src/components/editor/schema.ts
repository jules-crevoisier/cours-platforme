import { BlockNoteSchema, createCodeBlockSpec } from "@blocknote/core";
import { codeBlockOptions } from "@blocknote/code-block";
import { createCalloutBlock } from "./callout-block";
import { createEmbedBlock } from "./embed-block";

const LANGUAGES: Record<string, { name: string; aliases?: string[] }> = codeBlockOptions.supportedLanguages;
const LANGUAGE_BY_ALIAS = new Map<string, string>();
for (const [id, { aliases }] of Object.entries(LANGUAGES)) {
  LANGUAGE_BY_ALIAS.set(id, id);
  for (const alias of aliases ?? []) LANGUAGE_BY_ALIAS.set(alias.toLowerCase(), id);
}

/** « bash » → « shellscript », « js » → « javascript », inconnu → texte brut */
export function resolveCodeLanguage(language: unknown): string {
  return (typeof language === "string" && LANGUAGE_BY_ALIAS.get(language.toLowerCase())) || "text";
}

/**
 * Bloc de code avec la liste de langages de @blocknote/code-block. BlockNote garde tel quel le langage lu
 * dans ```bash ou <code class="language-bash"> et plante au rendu s'il n'est pas un identifiant connu :
 * on ramène les alias à leur identifiant (lecture du HTML/Markdown) et on rend en texte brut un langage inconnu.
 */
function createSafeCodeBlockSpec() {
  const spec = createCodeBlockSpec({ ...codeBlockOptions, defaultLanguage: "text" });
  const { parse, render } = spec.implementation;
  return {
    ...spec,
    implementation: {
      ...spec.implementation,
      parse: (el: HTMLElement) => {
        const props = parse?.(el);
        return props && { ...props, language: resolveCodeLanguage(props.language) };
      },
      render(this: unknown, block: Parameters<typeof render>[0], editor: Parameters<typeof render>[1]) {
        const language = block.props.language;
        const safe = language in LANGUAGES ? block : { ...block, props: { ...block.props, language: resolveCodeLanguage(language) } };
        return render.call(this as ThisParameterType<typeof render>, safe, editor);
      },
    },
  } as typeof spec;
}

/**
 * Schéma de l'éditeur = schéma par défaut de BlockNote (les documents existants se chargent tels quels)
 * + bloc « embed » + encadré BookStack (« callout ») + bloc de code tolérant aux langages inconnus.
 */
export function createEditorSchema(peertubeHosts: string[]) {
  return BlockNoteSchema.create().extend({
    blockSpecs: {
      codeBlock: createSafeCodeBlockSpec(),
      embed: createEmbedBlock(peertubeHosts),
      callout: createCalloutBlock(),
    },
  });
}

export type EditorSchema = ReturnType<typeof createEditorSchema>;
export type EditorInstance = EditorSchema["BlockNoteEditor"];
export type EditorPartialBlock = EditorSchema["PartialBlock"];
