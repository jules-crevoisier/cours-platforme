import Link from "next/link";
import { formatDateTime, formatTime, timeAgo } from "@/lib/format";
import { LINK_STATUS_LABELS } from "@/lib/link-check-core";
import { EmptyState } from "@/components/ui";
import { loadStaffTodo } from "./lib/queries";
import { excerpt, plural } from "./lib/todo";
import { DeadlineChip, Row, SaeLine, TodoSection } from "./ui";

function hostOf(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.hostname.replace(/^www\./, "") : null;
  } catch {
    return null;
  }
}

function More({ shown, total }: { shown: number; total: number }) {
  if (total <= shown) return null;
  return <p className="text-sm text-muted">+ {total - shown} autres</p>;
}

/** Équipe pédagogique : seules les sections qui contiennent quelque chose sont affichées */
export async function StaffTodo({ userId, now }: { userId: string; now: Date }) {
  const data = await loadStaffTodo(userId, now);
  const empty =
    data.toReview.length + data.links.length + data.showcases.length + data.questions.length + data.defenses.length === 0;

  if (empty) {
    return data.hasSaes ? (
      <EmptyState>Rien à traiter.</EmptyState>
    ) : (
      <EmptyState
        action={
          <Link href="/saes/new" className="btn btn-primary">
            Nouvelle SAÉ
          </Link>
        }
      >
        Vous ne gérez aucune SAÉ.
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {data.toReview.length > 0 && (
        <TodoSection id="a-corriger" title={`À corriger (${data.toReviewTotal})`}>
          {data.toReview.map((r) => (
            <Row
              key={r.milestone.id}
              chip={r.milestone.dueAt ? <DeadlineChip due={r.milestone.dueAt} now={now} /> : undefined}
              action={
                <Link
                  href={`/saes/${r.milestone.sae.id}/review?milestone=${encodeURIComponent(r.milestone.id)}`}
                  className="btn btn-primary w-full sm:w-auto"
                >
                  Corriger {plural(r.count, "copie")}
                  <span className="sr-only"> : {r.milestone.title}</span>
                </Link>
              }
            >
              <span className="font-semibold break-words">{r.milestone.title}</span>
              <SaeLine sae={r.milestone.sae} />
            </Row>
          ))}
        </TodoSection>
      )}

      {data.links.length > 0 && (
        <div className="flex flex-col gap-2">
          <TodoSection id="liens" title="Liens à problème">
            {data.links.map((l) => {
              const host = hostOf(l.url);
              return (
                <Row
                  key={l.id}
                  chip={
                    l.checkStatus && (
                      <span className={`badge ${l.checkStatus === "BROKEN" ? "badge-danger" : "badge-warn"}`}>
                        {LINK_STATUS_LABELS[l.checkStatus]}
                      </span>
                    )
                  }
                  action={
                    <Link href={`/saes/${l.group.sae.id}/groups/${l.group.id}`} className="btn w-full sm:w-auto">
                      Voir le groupe
                      <span className="sr-only"> {l.group.name}</span>
                    </Link>
                  }
                >
                  <span className="font-semibold break-words">
                    {l.group.name}
                    {l.milestone && <span className="font-normal text-muted"> — {l.milestone.title}</span>}
                  </span>
                  {host && (
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      title={l.checkNote ?? undefined}
                      className="self-start text-sm break-all text-accent underline"
                    >
                      {l.label ? `${l.label} (${host})` : host}
                      <span className="sr-only"> (nouvel onglet)</span>
                    </a>
                  )}
                </Row>
              );
            })}
          </TodoSection>
          <More shown={data.links.length} total={data.linkCount} />
        </div>
      )}

      {data.showcases.length > 0 && (
        <div className="flex flex-col gap-2">
          <TodoSection id="vitrine" title="Vitrine à valider">
            {data.showcases.map((g) => (
              <Row
                key={g.id}
                action={
                  <Link href={`/saes/${g.sae.id}/groups/${g.id}`} className="btn w-full sm:w-auto">
                    Examiner
                    <span className="sr-only"> : {g.showcaseTitle || g.name}</span>
                  </Link>
                }
              >
                <span className="font-semibold break-words">{g.showcaseTitle || g.name}</span>
                <span className="flex flex-wrap gap-x-4 text-sm text-muted">
                  <span>{g.name}</span>
                  <time dateTime={g.updatedAt.toISOString()} title={formatDateTime(g.updatedAt)}>
                    {timeAgo(g.updatedAt, now)}
                  </time>
                </span>
              </Row>
            ))}
          </TodoSection>
          <More shown={data.showcases.length} total={data.showcaseCount} />
        </div>
      )}

      {data.questions.length > 0 && (
        <div className="flex flex-col gap-2">
          <TodoSection id="questions" title="Questions sans réponse">
            {data.questions.map((q) => (
              <Row
                key={q.id}
                action={
                  <Link href={`/courses/${q.page.course.slug}/pages/${q.page.id}`} className="btn w-full sm:w-auto">
                    Répondre
                  </Link>
                }
              >
                <span className="break-words">« {excerpt(q.body)} »</span>
                <span className="flex flex-wrap gap-x-4 text-sm text-muted">
                  <span className="break-words">{q.page.title}</span>
                  <time dateTime={q.createdAt.toISOString()} title={formatDateTime(q.createdAt)}>
                    {timeAgo(q.createdAt, now)}
                  </time>
                </span>
              </Row>
            ))}
          </TodoSection>
          <More shown={data.questions.length} total={data.questionCount} />
        </div>
      )}

      {data.defenses.length > 0 && (
        <TodoSection id="soutenances" title="Prochaines soutenances">
          {data.defenses.map((d) => {
            const end = new Date(d.startsAt.getTime() + d.durationMin * 60_000);
            return (
              <Row
                key={d.id}
                chip={<DeadlineChip due={d.startsAt} now={now} />}
                action={
                  <Link href={`/saes/${d.sae.id}/defenses`} className="btn w-full sm:w-auto">
                    Planning
                  </Link>
                }
              >
                <span className="font-semibold break-words">{d.group?.name ?? "Groupe"}</span>
                <span className="flex flex-wrap gap-x-4 text-sm text-muted">
                  <span>{d.sae.code ?? d.sae.title}</span>
                  <span>
                    {formatTime(d.startsAt)}–{formatTime(end)}
                  </span>
                  {d.location && <span>{d.location}</span>}
                </span>
              </Row>
            );
          })}
        </TodoSection>
      )}
    </div>
  );
}
