import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { assertAllowed, requireUser } from "@/lib/session";
import { isStaff } from "@/lib/permissions";
import { EmptyState, PageHeader } from "@/components/ui";
import { MAX_SNIPPETS } from "@/app/assessments/_lib/snippets";
import { ConfirmActionButton } from "@/app/assessments/_lib/confirm-action-button";
import { createSnippet, deleteSnippet, updateSnippet } from "./actions";
import { SnippetForm } from "./snippet-form";

export const metadata: Metadata = { title: "Banque de commentaires" };

/** Valeur de filtre « sans étiquette » */
const UNTAGGED = "-";

function pick(value: string | string[] | undefined) {
  return typeof value === "string" ? value : Array.isArray(value) ? value[0] : undefined;
}

export default async function CommentBankPage({ searchParams }: PageProps<"/me/comment-bank">) {
  const user = await requireUser();
  assertAllowed(isStaff(user));

  const tagFilter = pick((await searchParams).tag)?.slice(0, 60);

  const [total, untagged, tagRows, snippets] = await Promise.all([
    db.commentSnippet.count({ where: { authorId: user.id } }),
    db.commentSnippet.count({ where: { authorId: user.id, tag: null } }),
    db.commentSnippet.groupBy({
      by: ["tag"],
      where: { authorId: user.id, tag: { not: null } },
      _count: { _all: true },
      orderBy: { tag: "asc" },
    }),
    db.commentSnippet.findMany({
      where: {
        authorId: user.id,
        ...(tagFilter === UNTAGGED ? { tag: null } : tagFilter ? { tag: tagFilter } : {}),
      },
      orderBy: [{ tag: "asc" }, { createdAt: "desc" }],
      select: { id: true, tag: true, body: true },
      take: MAX_SNIPPETS,
    }),
  ]);
  const tags = tagRows.flatMap((row) => (row.tag ? [{ tag: row.tag, count: row._count._all }] : []));
  const showFilters = tags.length > 0;

  const filters = [
    { href: "/me/comment-bank", label: "Tous", count: total, active: !tagFilter },
    ...tags.map((t) => ({
      href: `/me/comment-bank?tag=${encodeURIComponent(t.tag)}`,
      label: t.tag,
      count: t.count,
      active: tagFilter === t.tag,
    })),
    ...(untagged > 0
      ? [{ href: `/me/comment-bank?tag=${UNTAGGED}`, label: "Sans étiquette", count: untagged, active: tagFilter === UNTAGGED }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-10">
      <PageHeader title="Banque de commentaires" />

      <section aria-labelledby="new-snippet-title" className="flex max-w-3xl flex-col gap-3">
        <h2 id="new-snippet-title" className="text-xl">
          Nouveau commentaire
        </h2>
        {total >= MAX_SNIPPETS ? (
          <p className="text-sm text-warn">Limite de {MAX_SNIPPETS} commentaires atteinte.</p>
        ) : (
          <SnippetForm action={createSnippet} submitLabel="Ajouter" resetOnSuccess tagListId="snippet-tags" />
        )}
        <datalist id="snippet-tags">
          {tags.map((t) => (
            <option key={t.tag} value={t.tag} />
          ))}
        </datalist>
      </section>

      <section aria-labelledby="snippets-title" className="flex flex-col gap-4">
        <h2 id="snippets-title" className="text-xl">
          Mes commentaires
        </h2>

        {showFilters && (
          <nav aria-label="Filtrer par étiquette">
            <ul className="flex flex-wrap gap-x-5">
              {filters.map((f) => (
                <li key={f.href}>
                  <Link
                    href={f.href}
                    aria-current={f.active ? "page" : undefined}
                    className={`inline-flex min-h-11 items-center gap-1.5 text-sm ${
                      f.active ? "font-semibold text-ink" : "text-accent underline hover:decoration-2"
                    }`}
                  >
                    {f.label}
                    <span className="text-muted">{f.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {total === 0 ? (
          <EmptyState>Aucun commentaire.</EmptyState>
        ) : snippets.length === 0 ? (
          <EmptyState
            action={
              showFilters ? undefined : (
                <Link href="/me/comment-bank" className="btn">
                  Effacer
                </Link>
              )
            }
          >
            Aucun commentaire pour ce filtre.
          </EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {snippets.map((snippet) => (
              <li key={snippet.id} className="flex flex-col gap-2 py-4">
                {snippet.tag && <p className="text-sm font-semibold">{snippet.tag}</p>}
                <p className="max-w-prose break-words whitespace-pre-line">{snippet.body}</p>
                <details>
                  <summary className="btn btn-ghost cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                    Modifier<span className="sr-only"> ce commentaire</span>
                  </summary>
                  <div className="mt-3 flex max-w-3xl flex-col gap-4 border border-line p-4">
                    <SnippetForm
                      action={updateSnippet.bind(null, snippet.id)}
                      initial={{ tag: snippet.tag, body: snippet.body }}
                      submitLabel="Enregistrer"
                      tagListId="snippet-tags"
                    />
                    <ConfirmActionButton
                      action={deleteSnippet.bind(null, snippet.id)}
                      label="Supprimer"
                      pendingLabel="Suppression…"
                      confirmMessage="Supprimer ce commentaire ?"
                      ariaLabel={`Supprimer le commentaire ${snippet.tag ?? ""}`.trim()}
                      variant="danger"
                    />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
