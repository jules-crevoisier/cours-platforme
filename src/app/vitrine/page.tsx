import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { isStaff } from "@/lib/permissions";
import type { Prisma } from "@/generated/prisma/client";
import { publicName } from "@/app/me/portfolio/_lib/shared";
import { EmptyState, PageHeader } from "@/components/ui";
import { ShowcaseCard } from "./_components/showcase-card";
import { SHOWCASE_CATEGORIES, SHOWCASE_CATEGORY_LABELS, isShowcaseCategory } from "./_lib/showcase";

export const metadata: Metadata = {
  title: "Vitrine des projets",
  description: "Projets réalisés par les étudiants du département MMI dans le cadre de leurs SAÉ.",
  robots: { index: true, follow: true },
};

const PAGE_SIZE = 24;
const SEMESTERS = [1, 2, 3, 4, 5, 6];

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function hrefWith(params: { categorie?: string; semestre?: number; page?: number }) {
  const q = new URLSearchParams();
  if (params.categorie) q.set("categorie", params.categorie);
  if (params.semestre) q.set("semestre", String(params.semestre));
  if (params.page && params.page > 1) q.set("page", String(params.page));
  const s = q.toString();
  return s ? `/vitrine?${s}` : "/vitrine";
}

export default async function VitrinePage({ searchParams }: PageProps<"/vitrine">) {
  const sp = await searchParams;
  const rawCategory = one(sp.categorie);
  const category = isShowcaseCategory(rawCategory) ? rawCategory : undefined;
  const rawSemester = Number(one(sp.semestre));
  const semester = SEMESTERS.includes(rawSemester) ? rawSemester : undefined;
  const rawPage = Number(one(sp.page));
  const page = Number.isInteger(rawPage) && rawPage > 1 && rawPage <= 500 ? rawPage : 1;

  const user = await getCurrentUser();

  const where: Prisma.GroupWhereInput = {
    showcaseStatus: "PUBLISHED",
    ...(category ? { showcaseCategory: category } : {}),
    ...(semester ? { sae: { semester } } : {}),
  };

  const [total, groups] = await Promise.all([
    db.group.count({ where }),
    db.group.findMany({
      where,
      orderBy: [{ sae: { semester: "desc" } }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        showcaseTitle: true,
        showcaseSummary: true,
        showcaseUrl: true,
        showcaseImageUrl: true,
        showcaseCategory: true,
        sae: { select: { code: true, title: true, semester: true } },
        members: { orderBy: { joinedAt: "asc" }, take: 12, select: { user: { select: { name: true } } } },
      },
    }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = !!(category || semester);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Vitrine"
        meta={
          total > 0 ? (
            <span>
              {total} projet{total > 1 ? "s" : ""}
            </span>
          ) : undefined
        }
        actions={
          user && isStaff(user) ? (
            <Link href="/vitrine/moderation" className="btn">
              Modération
            </Link>
          ) : undefined
        }
      />

      <form method="get" action="/vitrine" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end" role="search" aria-label="Filtrer les projets">
        <div className="sm:w-60">
          <label htmlFor="filtre-categorie" className="label">
            Catégorie
          </label>
          <select id="filtre-categorie" name="categorie" defaultValue={category ?? ""} className="input">
            <option value="">Toutes</option>
            {SHOWCASE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {SHOWCASE_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:w-44">
          <label htmlFor="filtre-semestre" className="label">
            Semestre
          </label>
          <select id="filtre-semestre" name="semestre" defaultValue={semester ? String(semester) : ""} className="input">
            <option value="">Tous</option>
            {SEMESTERS.map((s) => (
              <option key={s} value={s}>
                Semestre {s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" className="btn btn-primary">
            Filtrer
          </button>
          {filtered && (
            <Link href="/vitrine" className="btn btn-ghost">
              Effacer
            </Link>
          )}
        </div>
      </form>

      {groups.length === 0 ? (
        <EmptyState>{filtered ? "Aucun résultat." : "Aucun projet."}</EmptyState>
      ) : (
        <ul aria-label="Projets" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <li key={g.id}>
              <ShowcaseCard
                id={g.id}
                title={g.showcaseTitle ?? "Projet sans titre"}
                summary={g.showcaseSummary}
                url={g.showcaseUrl}
                imageUrl={g.showcaseImageUrl}
                category={g.showcaseCategory}
                saeCode={g.sae.code}
                saeTitle={g.sae.title}
                semester={g.sae.semester}
                members={g.members.map((m) => publicName(m.user.name))}
              />
            </li>
          ))}
        </ul>
      )}

      {pageCount > 1 && (
        <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-2">
          {page > 1 ? (
            <Link href={hrefWith({ categorie: category, semestre: semester, page: page - 1 })} className="btn" rel="prev">
              Précédent
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-muted">
            Page {page} sur {pageCount}
          </span>
          {page < pageCount ? (
            <Link href={hrefWith({ categorie: category, semestre: semester, page: page + 1 })} className="btn" rel="next">
              Suivant
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
