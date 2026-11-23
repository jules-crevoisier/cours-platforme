// Tableau de suivi (équipe pédagogique) : groupe, étudiant·e, statut (un seul badge), action.
import Link from "next/link";
import { feedbackStatus, type AssessmentStatusValue } from "@/app/assessments/_lib/shared";
import { AssessmentStatusBadge, EmptyState, StatusBadge } from "@/components/ui";

export type FollowUpAssessment = {
  id: string;
  userId: string;
  status: AssessmentStatusValue;
  feedbackPublishedAt: Date | null;
  items: { level: number; teacherLevel: number | null; teacherComment: string | null }[];
};

type Props = {
  saeId: string;
  requiresDepositUrl: boolean;
  groups: {
    id: string;
    name: string;
    depositCount: number;
    members: { userId: string; name: string }[];
  }[];
  assessmentByUser: Map<string, FollowUpAssessment>;
};

/** Un seul statut par ligne : celui de l'auto-évaluation, puis celui du retour une fois soumise */
function RowStatus({ a }: { a: FollowUpAssessment | undefined }) {
  if (!a || a.status === "DRAFT") return <AssessmentStatusBadge status={a?.status ?? "NONE"} />;
  const feedback = feedbackStatus(a);
  if (feedback === "PUBLISHED") return <StatusBadge tone="ok">Retour publié</StatusBadge>;
  if (feedback === "DRAFT") return <StatusBadge>Retour en brouillon</StatusBadge>;
  return <AssessmentStatusBadge status="SUBMITTED" />;
}

export function FollowUp({ saeId, requiresDepositUrl, groups, assessmentByUser }: Props) {
  if (groups.length === 0) return <EmptyState>Aucun groupe.</EmptyState>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
        <caption className="sr-only">Auto-évaluations du jalon par groupe</caption>
        <thead>
          <tr className="border-b border-line text-muted">
            <th scope="col" className="py-2 pr-4 font-semibold">
              Groupe
            </th>
            <th scope="col" className="py-2 pr-4 font-semibold">
              Étudiant·e
            </th>
            <th scope="col" className="py-2 pr-4 font-semibold">
              Statut
            </th>
            <th scope="col" className="py-2 font-semibold">
              <span className="sr-only">Action</span>
            </th>
          </tr>
        </thead>
        {groups.map((group) => {
          const groupCell = (
            <th
              scope="rowgroup"
              rowSpan={Math.max(group.members.length, 1)}
              className="py-2 pr-4 align-top font-normal"
            >
              <Link href={`/saes/${saeId}/groups/${group.id}`} className="link break-words">
                {group.name}
              </Link>
              {requiresDepositUrl && group.depositCount === 0 && (
                <span className="block text-danger">Aucune URL déposée</span>
              )}
            </th>
          );
          return (
            <tbody key={group.id} className="border-b border-line">
              {group.members.length === 0 ? (
                <tr>
                  {groupCell}
                  <td className="py-2 text-muted" colSpan={3}>
                    Aucun membre
                  </td>
                </tr>
              ) : (
                group.members.map((member, i) => {
                  const a = assessmentByUser.get(member.userId);
                  return (
                    <tr key={member.userId} className="align-top">
                      {i === 0 && groupCell}
                      <th scope="row" className="py-2 pr-4 font-semibold break-words">
                        {member.name}
                      </th>
                      <td className="py-2 pr-4">
                        <RowStatus a={a} />
                      </td>
                      <td className="py-2 text-right">
                        {a && (
                          <Link
                            href={`/assessments/${a.id}`}
                            className="link inline-flex min-h-11 items-center pointer-fine:min-h-10"
                            aria-label={`Ouvrir l'auto-évaluation de ${member.name}`}
                          >
                            Ouvrir
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}
