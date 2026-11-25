import { z } from "zod";

/** Validation minimale du contenu envoyé par l'éditeur avant écriture en base */
export const editorContentSchema = z.object({
  // Aller-retour JSON : BlockNote produit parfois des `undefined` (ex. columnWidths d'un tableau collé en Markdown),
  // que Prisma refuse dans une colonne Json ; JSON.stringify les remplace par `null` / les supprime.
  content: z
    .array(z.unknown())
    .max(5000)
    .transform((blocks) => JSON.parse(JSON.stringify(blocks)) as unknown[]),
  markdown: z.string().max(2_000_000),
});

export function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
