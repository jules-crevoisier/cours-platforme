import { describe, expect, it } from "vitest";
import { calloutTypeFromClass, hasCalloutMarkdown, liftBookStackBlocks, lowerCalloutsForMarkdown } from "./bookstack-blocks";

const text = (t: string) => ({ type: "text", text: t, styles: {} });

describe("liftBookStackBlocks", () => {
  it("une citation « [!WARNING] » devient un encadré avertissement sans le marqueur", () => {
    const [b] = liftBookStackBlocks([
      { id: "a", type: "quote", props: {}, content: [text("[!WARNING]\nRendu vendredi")], children: [] },
    ]);
    expect(b).toMatchObject({ id: "a", type: "callout", props: { type: "warning" }, content: [text("Rendu vendredi")] });
  });
  it("les alias GitHub sont ramenés aux types BookStack", () => {
    const [b] = liftBookStackBlocks([{ type: "quote", content: [text("[!TIP] Astuce")] }]);
    expect(b).toMatchObject({ type: "callout", props: { type: "success" }, content: [text("Astuce")] });
  });
  it("une citation ordinaire reste une citation", () => {
    const q = { type: "quote", content: [text("Citation")] };
    expect(liftBookStackBlocks([q])[0]).toBe(q);
  });
  it("un lien « Intégration » vers un service autorisé devient une intégration", () => {
    const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    const [b] = liftBookStackBlocks([
      { type: "paragraph", content: [{ type: "link", href: url, content: [text("Intégration")] }], children: [] },
    ]);
    expect(b).toMatchObject({ type: "embed", props: { url } });
  });
  it("un lien « Intégration » vers un service inconnu reste un lien", () => {
    const p = { type: "paragraph", content: [{ type: "link", href: "https://exemple.org", content: [text("Intégration")] }] };
    expect(liftBookStackBlocks([p])[0]).toBe(p);
  });
});

describe("lowerCalloutsForMarkdown", () => {
  it("aller-retour encadré → citation balisée → encadré", () => {
    const callout = { id: "c", type: "callout", props: { type: "danger" }, content: [text("Attention")], children: [] };
    const [lowered] = lowerCalloutsForMarkdown([callout]);
    expect(lowered).toMatchObject({ type: "quote", content: [text("[!DANGER]\n"), text("Attention")] });
    expect(liftBookStackBlocks([lowered])[0]).toMatchObject({ type: "callout", props: { type: "danger" }, content: [text("Attention")] });
  });
});

describe("utilitaires", () => {
  it("lit la classe HTML BookStack", () => {
    expect(calloutTypeFromClass("callout success")).toBe("success");
    expect(calloutTypeFromClass("callout")).toBe("info");
    expect(calloutTypeFromClass("note")).toBeUndefined();
  });
  it("détecte une alerte dans du Markdown collé", () => {
    expect(hasCalloutMarkdown("# T\n\n> [!NOTE]\n> x")).toBe(true);
    expect(hasCalloutMarkdown("> citation")).toBe(false);
  });
});

describe("liftBookStackBlocks — blancs du lecteur Markdown", () => {
  it("retire l'espace laissée après « > » en début de ligne", () => {
    const [b] = liftBookStackBlocks([{ type: "quote", content: [text(" [!INFO]\n Rendu\n sinon")] }]);
    expect(b).toMatchObject({ type: "callout", content: [text("Rendu\nsinon")] });
  });
});
