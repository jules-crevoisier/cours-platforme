import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { requireUser } from "@/lib/session";
import { formatDateTime, timeAgo } from "@/lib/format";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { MAX_QUERY_LENGTH, planSearch, type SnippetPart } from "./_lib/query";
import { searchContent, type SearchResults } from "./_lib/search";

function readQuery(value: string | string[] | undefined) {
  return (typeof value === "string" ? value : "").trim().slice(0, MAX_QUERY_LENGTH);
}

export async function generateMetadata({ searchParams }: PageProps<"/search">): Promise<Metadata> {
  const q = readQuery((await searchParams).q);
  return { title: q ? `« ${q} » — Recherche` : "Recherche", robots: { index: false } };
}

function Snippet({ parts }: { parts: SnippetPart[] }) {
  if (parts.length === 0) return null;
  return (
    <p className="text-sm break-words text-muted">
      {parts.map((part, i) =>
        part.match ? (
          <mark key={i} className="bg-accent-soft px-0.5 font-semibold text-ink">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </p>
  );
}

type Row = {
  key: string;
  href: string;
  title: string;
  /** Type de résultat (seul badge de la ligne) */
  type: string;
  details: ReactNode[];
  snippet: SnippetPart[];
};

/** Résultats en une seule liste : pages de cours, puis cours, puis SAÉ */
function toRows(results: SearchResults): Row[] {
  return [
    ...results.pages.map((hit) => ({
      key: `page-${hit.id}`,
      href: hit.href,
      title: hit.title,
      type: "Page",
      details: [
        <span key="course">{hit.courseTitle}</span>,
        <time key="updated" dateTime={hit.updatedAt.toISOString()} title={formatDateTime(hit.updatedAt)}>
          Modifiée {timeAgo(hit.updatedAt)}
        </time>,
      ],
      snippet: hit.snippet,
    })),
    ...results.courses.map((hit) => ({
      key: `course-${hit.id}`,
      href: hit.href,
      title: hit.title,
      type: "Cours",
      details: [],
      snippet: hit.snippet,
    })),
    ...results.saes.map((hit) => ({
      key: `sae-${hit.id}`,
      href: hit.href,
      title: hit.title,
      type: hit.code ?? "SAÉ",
      details: hit.semester != null ? [<span key="semester">Semestre {hit.semester}</span>] : [],
      snippet: hit.snippet,
    })),
  ];
}

function Results({ rows }: { rows: Row[] }) {
  if (rows.length === 0) return <EmptyState>Aucun résultat.</EmptyState>;
  return (
    <ul className="divide-y divide-line border-y border-line">
      {rows.map((row) => (
        <li key={row.key} className="flex flex-col gap-1 py-3">
          <Link href={row.href} className="inline-flex min-h-11 items-center font-semibold break-words hover:underline">
            {row.title}
          </Link>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <StatusBadge>{row.type}</StatusBadge>
            {row.details}
          </p>
          <Snippet parts={row.snippet} />
        </li>
      ))}
    </ul>
  );
}

/** Recherche plein texte : pages de cours, cours et SAÉ visibles par l'utilisateur */
export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const user = await requireUser();
  const q = readQuery((await searchParams).q);
  const plan = planSearch(q);
  const results = plan.kind === "empty" ? null : await searchContent(user, plan);
  const rows = results && !results.failed ? toRows(results) : null;

  return (
    <div className="flex max-w-[70ch] flex-col gap-6">
      <PageHeader
        title="Recherche"
        meta={
          rows && rows.length > 0 ? (
            <span aria-live="polite">
              {rows.length} résultat{rows.length > 1 ? "s" : ""}
            </span>
          ) : undefined
        }
      />

      <form action="/search" method="get" role="search" className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 sm:flex-1">
          <label htmlFor="search-q" className="label">
            Mots-clés
          </label>
          <input
            id="search-q"
            name="q"
            type="search"
            defaultValue={q}
            maxLength={MAX_QUERY_LENGTH}
            enterKeyHint="search"
            autoComplete="off"
            className="input"
          />
        </div>
        <button type="submit" className="btn btn-primary shrink-0">
          Rechercher
        </button>
      </form>

      {results?.failed ? (
        <p role="alert" className="form-error">
          Recherche momentanément indisponible. Réessayez plus tard.
        </p>
      ) : rows ? (
        <Results rows={rows} />
      ) : (
        q && <p className="text-muted">Saisissez au moins une lettre ou un chiffre.</p>
      )}
    </div>
  );
}
