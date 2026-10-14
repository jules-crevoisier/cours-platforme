// Import des cours depuis un BookStack vers la plateforme.
//
// Deux sources :
//  1. Exports « Fichiers web » (HTML) — AUCUN droit admin requis, c'est le mode conseillé :
//       npx tsx scripts/import-bookstack.ts --from-html ./exports --owner prof@univ.fr
//     (un fichier .html par livre : BookStack → livre → Exporter → Fichiers web ; le nom du fichier
//      sans extension sert de slug du cours)
//  2. API REST (jeton d'API = droit admin sur la plupart des instances) :
//       BOOKSTACK_URL=… BOOKSTACK_TOKEN_ID=… BOOKSTACK_TOKEN_SECRET=… npx tsx scripts/import-bookstack.ts
//
// Simulation par défaut (n'écrit rien) ; --apply pour écrire (avec --owner). Options :
//   --include-archived  importe aussi BACKUP / OLD / Test      --only "WR1"  filtre sur le titre
//
// Règles : un livre → un cours non publié ; chapitres/pages → arbre de pages ; seule la version la plus
// récente d'un même cours est importée ; un livre SAÉ (code SAE/WS ou étagère « SAE Semestre N » en mode API)
// crée aussi une SAÉ avec un jalon par chapitre « SEMAINE… » ; idempotent (slug déjà présent = laissé intact).
import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  chapterIsMilestone,
  detectSae,
  htmlToMarkdown,
  parseBookExport,
  parseMillesime,
  selectCurrentVersions,
  uniqueSlug,
  type BsBook,
  type BsShelf,
  type CourseCandidate,
  type ExportedBook,
} from "../src/lib/bookstack-import";

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const opt = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const fromHtml = opt("from-html");
const apply = flag("apply");
const ownerEmail = opt("owner");
if (apply && !ownerEmail) {
  console.error("--owner <email> est requis avec --apply (enseignant ou admin propriétaire des cours importés).");
  process.exit(1);
}

const BASE = (process.env.BOOKSTACK_URL ?? "").replace(/\/+$/, "");
const TOKEN = `${process.env.BOOKSTACK_TOKEN_ID ?? ""}:${process.env.BOOKSTACK_TOKEN_SECRET ?? ""}`;
if (!fromHtml && (!BASE || TOKEN === ":")) {
  console.error("Donne --from-html <dossier> (sans droit admin) ou BOOKSTACK_URL + BOOKSTACK_TOKEN_ID + BOOKSTACK_TOKEN_SECRET.");
  process.exit(1);
}

async function api<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/api/${path}`, { headers: { Authorization: `Token ${TOKEN}` } });
  if (!res.ok) throw new Error(`BookStack ${path} → HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function listAll<T>(resource: string): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += 100) {
    const r = await api<{ data: T[]; total: number }>(`${resource}?count=100&offset=${offset}`);
    out.push(...r.data);
    if (offset + 100 >= r.total) break;
  }
  return out;
}

type BsPageRef = { id: number; name: string; type: "page" };
type BsChapterRef = { id: number; name: string; type: "chapter"; pages?: BsPageRef[] };
type BsBookDetail = BsBook & { contents: (BsPageRef | BsChapterRef)[] };
type BsPage = { id: number; name: string; html?: string; markdown?: string };

async function pageMarkdown(id: number): Promise<string> {
  const p = await api<BsPage>(`pages/${id}`);
  return p.markdown?.trim() ? p.markdown : htmlToMarkdown(p.html ?? "");
}

/** Une source = des candidats + un chargeur du contenu (tous deux indépendants de BookStack ensuite). */
type Source = { candidates: CourseCandidate[]; load: (c: CourseCandidate) => Promise<ExportedBook> };

async function htmlSource(dir: string): Promise<Source> {
  const books = new Map<number, ExportedBook>();
  const candidates: CourseCandidate[] = [];
  readdirSync(dir)
    .filter((f) => extname(f).toLowerCase() === ".html")
    .sort()
    .forEach((file, i) => {
      const book = parseBookExport(readFileSync(join(dir, file), "utf8"));
      const slug = basename(file, extname(file)).replace(/^bookstack-/, "");
      books.set(i, book);
      candidates.push({ id: i, name: book.title, slug, shelves: [], ...parseMillesime(book.title) });
    });
  return { candidates, load: async (c) => books.get(c.id)! };
}

async function apiSource(): Promise<Source> {
  const [books, shelves] = await Promise.all([listAll<BsBook>("books"), listAll<BsShelf>("shelves")]);
  const shelvesOf = new Map<number, string[]>();
  for (const sh of shelves) {
    const detail = await api<BsShelf>(`shelves/${sh.id}`);
    for (const b of detail.books ?? []) shelvesOf.set(b.id, [...(shelvesOf.get(b.id) ?? []), sh.name]);
  }
  const candidates = books.map((b) => ({ ...b, ...parseMillesime(b.name), shelves: shelvesOf.get(b.id) ?? [] }));
  return {
    candidates,
    load: async (c) => {
      const d = await api<BsBookDetail>(`books/${c.id}`);
      const items: ExportedBook["items"] = [];
      for (const it of d.contents) {
        if (it.type === "page") items.push({ type: "page", title: it.name, markdown: await pageMarkdown(it.id) });
        else {
          const pages = [];
          for (const p of it.pages ?? []) pages.push({ title: p.name, markdown: await pageMarkdown(p.id) });
          items.push({ type: "chapter", title: it.name, markdown: "", pages });
        }
      }
      return { title: d.name, items };
    },
  };
}

async function main() {
  console.log(`Source : ${fromHtml ? `exports HTML (${fromHtml})` : BASE} — ${apply ? "ÉCRITURE" : "simulation (ajouter --apply pour écrire)"}`);
  const source = fromHtml ? await htmlSource(fromHtml) : await apiSource();

  const only = opt("only")?.toLowerCase();
  const candidates = source.candidates.filter((b) => !only || b.name.toLowerCase().includes(only));
  const { keep, skipped } = selectCurrentVersions(candidates, { includeArchived: flag("include-archived") });
  console.log(`${candidates.length} livres : ${keep.length} à importer, ${skipped.length} ignorés.`);
  for (const s of skipped) console.log(`  ignoré (${s.reason === "archived" ? "sauvegarde" : "ancienne version"}) : ${s.book.name}`);

  const db = apply ? new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL!) }) : null;
  const owner = db ? await db.user.findUnique({ where: { email: ownerEmail! }, select: { id: true } }) : null;
  if (db && !owner) throw new Error(`Utilisateur introuvable : ${ownerEmail}`);
  const taken = new Set<string>(db ? (await db.course.findMany({ select: { slug: true } })).map((c) => c.slug) : []);

  let nCourses = 0, nPages = 0, nSaes = 0, nExisting = 0;
  for (const cand of keep) {
    const sae = detectSae({ name: cand.name, shelves: cand.shelves });
    const slug = uniqueSlug(cand.slug || cand.base, new Set()); // slug stable (idempotence)
    if (taken.has(slug)) {
      nExisting++;
      console.log(`  existe déjà : ${slug}`);
      continue;
    }
    const book = await source.load(cand);
    const pagesCount = book.items.reduce((n, it) => n + 1 + (it.type === "chapter" ? it.pages.length : 0), 0);
    const milestones = sae ? book.items.filter((it) => it.type === "chapter" && chapterIsMilestone(it.title)) : [];
    console.log(`  ${sae ? "SAÉ  " : "cours"} ${cand.base} → /${slug} (${pagesCount} pages${sae ? `, ${milestones.length} jalons` : ""})`);
    nCourses++;
    nPages += pagesCount;
    if (sae) nSaes++;
    if (!db || !owner) continue;

    const course = await db.course.create({
      data: { slug, title: cand.base.slice(0, 190), summary: cand.description?.trim() || null, published: false, ownerId: owner.id },
    });
    taken.add(slug);
    let pos = 0;
    for (const it of book.items) {
      const created = await db.page.create({
        data: { courseId: course.id, title: it.title.slice(0, 190), position: pos++, markdown: it.markdown || null },
      });
      if (it.type === "chapter") {
        let sub = 0;
        for (const p of it.pages) {
          await db.page.create({
            data: { courseId: course.id, parentId: created.id, title: p.title.slice(0, 190), position: sub++, markdown: p.markdown || null },
          });
        }
      }
    }
    if (sae) {
      await db.sae.create({
        data: {
          code: sae.code,
          title: cand.base.slice(0, 190),
          semester: sae.semester,
          published: false,
          courseId: course.id,
          ownerId: owner.id,
          milestones: { create: milestones.map((m, i) => ({ title: m.title.slice(0, 190), position: i })) },
        },
      });
    }
  }

  console.log(
    `\n${apply ? "Importé" : "À importer"} : ${nCourses} cours, ${nPages} pages, ${nSaes} SAÉ` +
      (nExisting ? ` (${nExisting} déjà présents, laissés intacts)` : "") +
      ".",
  );
  await db?.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
