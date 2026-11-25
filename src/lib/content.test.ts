import { describe, expect, it } from "vitest";
import { editorContentSchema } from "./content";

describe("editorContentSchema", () => {
  it("remplace les undefined d'un tableau (columnWidths) pour que Prisma accepte le JSON", () => {
    const table = { type: "table", props: {}, content: { type: "tableContent", columnWidths: [undefined, 120, undefined], rows: [] } };
    const parsed = editorContentSchema.parse({ content: [table], markdown: "" });
    const widths = (parsed.content[0] as typeof table).content.columnWidths;
    expect(widths).toEqual([null, 120, null]);
    expect(widths).not.toContain(undefined);
  });
});
