// Import des cours depuis un BookStack (API REST) vers la plateforme.
//
// Usage (simulation par défaut, n'écrit rien) :
//   BOOKSTACK_URL=https://docs.mmi-troyes.fr BOOKSTACK_TOKEN_ID=… BOOKSTACK_TOKEN_SECRET=… \
//   npx tsx scripts/import-bookstack.ts --owner prof@univ.fr
// Écriture réelle : ajouter --apply. Options : --include-archived, --only "WR1" (filtre sur le titre).
//
// Règles :
//  - un livre → un cours (non publié : relecture avant mise en ligne) ; chapitres et pages → arbre de pages ;
//  - pour un même cours présent en plusieurs millésimes, seule la version la plus récente est importée ;
//    les sauvegardes (BACKUP, OLD, Test) sont ignorées sauf --include-archived ;
//  - un livre SAÉ (étagère « SAE Semestre N » ou code SAE/WS dans le titre) crée aussi une SAÉ liée au cours,
//    avec un jalon par chapitre « SEMAINE… » (dates à renseigner ensuite) ;
//  - idempotent : un cours dont le slug existe déjà est laissé intact.
import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  chapterIsMilestone,
  detectSae,
  htmlToMarkdown,
  parseMillesime,
  selectCurrentVersions,
  uniqueSlug,
  type BsBook,
  type BsShelf,
  type CourseCandidate,
} from "../src/lib/bookstack-import";

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const opt = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const BASE = (process.env.BOOKSTACK_URL ?? "").replace(/\/+$/, "");
const TOKEN = `${process.env.BOOKSTACK_TOKEN_ID ?? ""}:${process.env.BOOKSTACK_TOKEN_SECRET ?? ""}`;
if (!BASE || TOKEN === ":") {
  console.error("BOOKSTACK_URL, BOOKSTACK_TOKEN_ID et BOOKSTACK_TOKEN_SECRET sont requis.");
  process.exit(1);
}
const apply = flag("apply");
const ownerEmail = opt("owner");
if (apply && !ownerEmail) {
  console.error("--owner <email> est requis avec --apply (enseignant ou admin propriétaire des cours importés).");
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

async function main() {
  console.log(`BookStack : ${BASE} — ${apply ? "ÉCRITURE" : "simulation (ajouter --apply pour écrire)"}`);
  const [books, shelves] = await Promise.all([listAll<BsBook>("books"), listAll<BsShelf>("shelves")]);
  const shelfNames = new Map<number, string>(shelves.map((s) => [s.id, s.name]));
  const shelvesOf = new Map<number, string[]>();
  for (const sh of shelves) {
    const detail = await api<BsShelf>(`shelves/${sh.id}`);
    for (const b of detail.books ?? []) shelvesOf.set(b.id, [...(shelvesOf.get(b.id) ?? []), shelfNames.get(sh.id)!]);
  }

  const only = opt("only")?.toLowerCase();
  const candidates: CourseCandidate[] = books
    .filter((b) => !only || b.name.toLowerCase().includes(only))
    .map((b) => ({ ...b, ...parseMillesime(b.name), shelves: shelvesOf.get(b.id) ?? [] }));
  const { keep, skipped } = selectCurrentVersions(candidates, { includeArchived: flag("include-archived") });

  console.log(`${books.length} livres : ${keep.length} à importer, ${skipped.length} ignorés.`);
  for (const s of skipped) console.log(`  ignoré (${s.reason === "archived" ? "sauvegarde" : "ancienne version"}) : ${s.book.name}`);

  const db = apply ? new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL!) }) : null;
  const owner = db ? await db.user.findUnique({ where: { email: ownerEmail! }, select: { id: true } }) : null;
  if (db && !owner) throw new Error(`Utilisateur introuvable : ${ownerEmail}`);
  const taken = new Set<string>(db ? (await db.course.findMany({ select: { slug: true } })).map((c) => c.slug) : []);

  let nCourses = 0, nPages = 0, nSaes = 0, nExisting = 0;
  for (const book of keep) {
    const sae = detectSae({ name: book.name, shelves: book.shelves });
    const slug = uniqueSlug(book.slug || book.base, new Set()); // slug stable = slug BookStack (idempotence)
    if (db && taken.has(slug)) {
      nExisting++;
      console.log(`  existe déjà : ${slug}`);
      continue;
    }
    const detail = await api<BsBookDetail>(`books/${book.id}`);
    const pagesCount = detail.contents.reduce((n, c) => n + (c.type === "chapter" ? 1 + (c.pages?.length ?? 0) : 1), 0);
    const milestones = sae ? detail.contents.filter((c): c is BsChapterRef => c.type === "chapter" && chapterIsMilestone(c.name)) : [];
    console.log(`  ${sae ? "SAÉ " : "cours"} ${book.base} → /${slug} (${pagesCount} pages${sae ? `, ${milestones.length} jalons` : ""})`);
    nCourses++;
    nPages += pagesCount;
    if (sae) nSaes++;
    if (!db || !owner) continue;

    const course = await db.course.create({
      data: { slug, title: book.base.slice(0, 190), summary: book.description?.trim() || null, published: false, ownerId: owner.id },
    });
    taken.add(slug);
    let pos = 0;
    for (const item of detail.contents) {
      if (item.type === "page") {
        await db.page.create({ data: { courseId: course.id, title: item.name, position: pos++, markdown: await pageMarkdown(item.id) } });
      } else {
        const chapter = await db.page.create({ data: { courseId: course.id, title: item.name, position: pos++ } });
        let sub = 0;
        for (const p of item.pages ?? []) {
          await db.page.create({
            data: { courseId: course.id, parentId: chapter.id, title: p.name, position: sub++, markdown: await pageMarkdown(p.id) },
          });
        }
      }
    }
    if (sae) {
      await db.sae.create({
        data: {
          code: sae.code,
          title: book.base.slice(0, 190),
          semester: sae.semester,
          published: false,
          courseId: course.id,
          ownerId: owner.id,
          milestones: { create: milestones.map((m, i) => ({ title: m.name, position: i })) },
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
