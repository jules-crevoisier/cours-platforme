// Évaluation entre pairs, vue de l'équipe pédagogique : moyenne de contribution reçue par membre.
import { contributionLabel } from "@/lib/assessment";
import { EmptyState, StatusBadge } from "@/components/ui";
import { averageLevel, formatAverage, formatDateTime, PEER_LOW_THRESHOLD } from "@/app/assessments/_lib/shared";

type Member = { userId: string; name: string };
type Review = {
  reviewerId: string;
  revieweeId: string;
  contribution: number;
  comment: string | null;
  updatedAt: Date;
};

type Props = {
  groups: { id: string; name: string; members: Member[] }[];
  reviews: Review[];
  /** Détail « qui a noté qui » (canSeePeerReviews) */
  canSeeDetails: boolean;
};

function analyseGroup(members: Member[], reviews: Review[]) {
  const ids = new Set(members.map((m) => m.userId));
  const valid = reviews.filter((r) => r.reviewerId !== r.revieweeId && ids.has(r.reviewerId) && ids.has(r.revieweeId));
  const expected = members.length - 1;
  const rows = members.map((m) => {
    const received = valid.filter((r) => r.revieweeId === m.userId);
    const given = valid.filter((r) => r.reviewerId === m.userId);
    const avg = averageLevel(received.map((r) => r.contribution));
    const reasons: string[] = [];
    if (avg !== null && avg <= PEER_LOW_THRESHOLD) reasons.push("moyenne reçue ≤ 1,5");
    if (given.length < expected) reasons.push("n'a pas évalué tous ses coéquipiers");
    return { ...m, avg, received: received.length, given: given.length, reasons };
  });
  return { valid, expected, rows, flagged: rows.some((r) => r.reasons.length > 0) };
}

export function PeerReviewOverview({ groups, reviews, canSeeDetails }: Props) {
  const nameById = new Map(groups.flatMap((g) => g.members.map((m) => [m.userId, m.name] as const)));
  const analysed = groups.map((g) => ({ group: g, ...analyseGroup(g.members, reviews) }));

  return (
    <section aria-labelledby="peer-overview-title" className="flex flex-col gap-6">
      <h2 id="peer-overview-title" className="text-xl">
        Évaluation entre pairs
      </h2>

      {groups.length === 0 ? (
        <EmptyState>Aucun groupe.</EmptyState>
      ) : (
        analysed.map(({ group, rows, valid, expected, flagged }) => (
          <div key={group.id} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <h3 className="text-base break-words">{group.name}</h3>
              {group.members.length > 1 &&
                (flagged ? (
                  <StatusBadge tone="warn">À vérifier</StatusBadge>
                ) : (
                  <StatusBadge tone="ok">Complet</StatusBadge>
                ))}
            </div>

            {group.members.length < 2 ? (
              <p className="text-sm text-muted">Moins de deux membres.</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
                    <caption className="sr-only">Évaluation entre pairs — {group.name}</caption>
                    <thead>
                      <tr className="border-b border-line text-muted">
                        <th scope="col" className="py-2 pr-4 font-semibold">
                          Membre
                        </th>
                        <th scope="col" className="py-2 pr-4 font-semibold">
                          Moyenne reçue
                        </th>
                        <th scope="col" className="py-2 pr-4 font-semibold">
                          Reçues
                        </th>
                        <th scope="col" className="py-2 pr-4 font-semibold">
                          Données
                        </th>
                        <th scope="col" className="py-2 font-semibold">
                          Vigilance
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.userId} className="border-b border-line align-top">
                          <th scope="row" className="py-2 pr-4 font-semibold break-words">
                            {row.name}
                          </th>
                          <td className="py-2 pr-4 whitespace-nowrap">{formatAverage(row.avg)}</td>
                          <td className="py-2 pr-4 whitespace-nowrap">
                            {row.received} sur {expected}
                          </td>
                          <td className="py-2 pr-4 whitespace-nowrap">
                            {row.given} sur {expected}
                          </td>
                          <td className="py-2">
                            {row.reasons.length > 0 ? (
                              <span className="text-warn">{row.reasons.join(", ")}</span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {canSeeDetails && (
                  <details>
                    <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold pointer-fine:min-h-10">
                      Détail des évaluations
                    </summary>
                    {valid.length === 0 ? (
                      <p className="text-sm text-muted">Aucune évaluation.</p>
                    ) : (
                      <ul className="flex flex-col divide-y divide-line">
                        {valid.map((r) => (
                          <li key={`${r.reviewerId}-${r.revieweeId}`} className="flex flex-col gap-1 py-3 text-sm">
                            <span>
                              <span className="font-semibold">{nameById.get(r.reviewerId) ?? "—"}</span>
                              <span aria-hidden="true"> → </span>
                              <span className="sr-only"> a évalué </span>
                              <span className="font-semibold">{nameById.get(r.revieweeId) ?? "—"}</span> :{" "}
                              {r.contribution}/4 — {contributionLabel(r.contribution)}
                            </span>
                            {r.comment && <span className="break-words whitespace-pre-line text-muted">{r.comment}</span>}
                            <time dateTime={r.updatedAt.toISOString()} className="text-xs text-muted">
                              {formatDateTime(r.updatedAt)}
                            </time>
                          </li>
                        ))}
                      </ul>
                    )}
                  </details>
                )}
              </>
            )}
          </div>
        ))
      )}
    </section>
  );
}
