import Link from "next/link";
import { formatTime } from "@/lib/format";
import { EmptyState } from "@/components/ui";
import { loadStudentTodo, type StudentItem, type StudentMilestoneItem } from "./lib/queries";
import { BUCKET_LABELS, groupByBucket, nextStudentAction, plural, type Bucket } from "./lib/todo";
import { DeadlineChip, Row, SaeLine, TodoSection } from "./ui";

/** Jalon : l'échéance (« Fait » quand tout est rendu) et le bouton de la prochaine action suffisent */
function MilestoneRow({ item, now }: { item: StudentMilestoneItem; now: Date }) {
  const complete = item.progress.done && !item.deposit.problem;
  const next = nextStudentAction({
    saeId: item.sae.id,
    milestoneId: item.milestoneId,
    groupId: item.groupId,
    hasCriteria: item.hasCriteria,
    assessmentId: item.assessment.id,
    assessmentStatus: item.assessment.status,
    feedbackPublished: item.assessment.feedbackPublished,
    depositRequired: item.deposit.required,
    depositCount: item.deposit.count,
    depositProblem: item.deposit.problem,
    peerPending: item.peer.pending,
  });

  return (
    <Row
      chip={<DeadlineChip due={item.due} now={now} done={complete} />}
      action={
        next && (
          <Link href={next.href} className={`btn w-full sm:w-auto ${next.primary ? "btn-primary" : ""}`}>
            {next.label}
            <span className="sr-only"> : {item.title}</span>
          </Link>
        )
      }
    >
      <Link href={`/saes/${item.sae.id}/milestones/${item.milestoneId}`} className="self-start font-semibold break-words hover:underline">
        {item.title}
      </Link>
      <SaeLine sae={item.sae} />
    </Row>
  );
}

function ItemRow({ item, now }: { item: StudentItem; now: Date }) {
  if (item.kind === "milestone") return <MilestoneRow item={item} now={now} />;
  if (item.kind === "defense") {
    const end = new Date(item.due.getTime() + item.durationMin * 60_000);
    return (
      <Row
        chip={<DeadlineChip due={item.due} now={now} />}
        action={
          <Link href={`/saes/${item.sae.id}/defenses`} className="btn w-full sm:w-auto">
            Voir le créneau
          </Link>
        }
      >
        <span className="font-semibold">Soutenance</span>
        <span className="flex flex-wrap gap-x-4 text-sm text-muted">
          <span>{item.sae.code ?? item.sae.title}</span>
          <span>
            {formatTime(item.due)}–{formatTime(end)}
          </span>
          {item.location && <span>{item.location}</span>}
        </span>
      </Row>
    );
  }
  return (
    <Row
      chip={<DeadlineChip due={item.due} now={now} />}
      action={
        <Link href={`/saes/${item.sae.id}/defenses`} className="btn btn-primary w-full sm:w-auto">
          Réserver
        </Link>
      }
    >
      <span className="font-semibold">Créneau de soutenance à réserver</span>
      <span className="flex flex-wrap gap-x-4 text-sm text-muted">
        <span>{item.sae.code ?? item.sae.title}</span>
        <span>{plural(item.freeSlots, "créneau libre", "créneaux libres")}</span>
      </span>
    </Row>
  );
}

const SECTION_ID: Record<Bucket, string> = { overdue: "en-retard", week: "cette-semaine", later: "plus-tard" };

export async function StudentTodo({ userId, now }: { userId: string; now: Date }) {
  const { hasGroups, items } = await loadStudentTodo(userId, now);

  if (!hasGroups) {
    return (
      <EmptyState
        action={
          <Link href="/saes" className="btn">
            Voir les SAÉ
          </Link>
        }
      >
        Vous n&apos;êtes dans aucun groupe de SAÉ.
      </EmptyState>
    );
  }

  const buckets = groupByBucket(items, now);
  const order = (["overdue", "week", "later"] as const).filter((b) => buckets[b].length > 0);
  if (order.length === 0) return <EmptyState>Rien à rendre pour le moment.</EmptyState>;

  return (
    <div className="flex flex-col gap-8">
      {order.map((b) => (
        <TodoSection key={b} id={SECTION_ID[b]} title={BUCKET_LABELS[b]} tone={b === "overdue" ? "danger" : undefined}>
          {buckets[b].map((item) => (
            <ItemRow key={item.key} item={item} now={now} />
          ))}
        </TodoSection>
      ))}
    </div>
  );
}
