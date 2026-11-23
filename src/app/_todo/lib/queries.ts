import "server-only";
import { db } from "@/lib/db";
import { OVERDUE_LOOKBACK_DAYS, linkProblem, milestoneProgress, type AssessmentStatus, type MilestoneProgress } from "./todo";

const DAY_MS = 86_400_000;

export type SaeRef = { id: string; code: string | null; title: string };

const saeSelect = { id: true, code: true, title: true } as const;

// ─────────────────────────────────────────────────────────────
// Étudiant
// ─────────────────────────────────────────────────────────────

export type StudentMilestoneItem = {
  kind: "milestone";
  key: string;
  due: Date | null;
  sae: SaeRef;
  milestoneId: string;
  title: string;
  groupId: string;
  progress: MilestoneProgress;
  hasCriteria: boolean;
  assessment: { id: string | null; status: AssessmentStatus | null; feedbackPublished: boolean };
  deposit: { required: boolean; count: number; problem: "BROKEN" | "PRIVATE" | null };
  peer: { enabled: boolean; pending: number };
};

export type StudentDefenseItem = {
  kind: "defense";
  key: string;
  due: Date;
  sae: SaeRef;
  groupId: string;
  groupName: string;
  durationMin: number;
  location: string | null;
};

export type StudentBookingItem = { kind: "booking"; key: string; due: Date; sae: SaeRef; freeSlots: number };

export type StudentItem = StudentMilestoneItem | StudentDefenseItem | StudentBookingItem;

export async function loadStudentTodo(userId: string, now: Date) {
  const memberships = await db.groupMember.findMany({
    where: { userId, group: { sae: { published: true } } },
    select: {
      group: {
        select: {
          id: true,
          name: true,
          saeId: true,
          sae: { select: saeSelect },
          members: { select: { userId: true }, take: 50 },
          defenseSlot: { select: { id: true, startsAt: true, durationMin: true, location: true } },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
    take: 50,
  });

  // Un groupe par SAÉ (le plus récent si plusieurs)
  const groupBySae = new Map<string, (typeof memberships)[number]["group"]>();
  for (const m of memberships) if (!groupBySae.has(m.group.saeId)) groupBySae.set(m.group.saeId, m.group);
  const groups = [...groupBySae.values()];
  if (groups.length === 0) return { hasGroups: false, items: [] as StudentItem[] };

  const saeIds = groups.map((g) => g.saeId);
  const groupIds = groups.map((g) => g.id);
  const lookback = new Date(now.getTime() - OVERDUE_LOOKBACK_DAYS * DAY_MS);

  const milestones = await db.milestone.findMany({
    where: { saeId: { in: saeIds }, OR: [{ dueAt: null }, { dueAt: { gte: lookback } }] },
    select: {
      id: true,
      title: true,
      dueAt: true,
      saeId: true,
      requiresDepositUrl: true,
      peerReviewEnabled: true,
      _count: { select: { criteria: true } },
    },
    orderBy: [{ dueAt: "asc" }, { position: "asc" }],
    take: 150,
  });
  const milestoneIds = milestones.map((m) => m.id);
  const peerMilestoneIds = milestones.filter((m) => m.peerReviewEnabled).map((m) => m.id);
  const saesWithoutSlot = groups.filter((g) => !g.defenseSlot).map((g) => g.saeId);

  const [assessments, links, reviews, freeSlots] = await Promise.all([
    milestoneIds.length
      ? db.selfAssessment.findMany({
          where: { userId, milestoneId: { in: milestoneIds } },
          select: { id: true, milestoneId: true, status: true, feedbackPublishedAt: true },
        })
      : Promise.resolve([]),
    milestoneIds.length
      ? db.depositLink.findMany({
          where: { groupId: { in: groupIds }, milestoneId: { in: milestoneIds } },
          select: { groupId: true, milestoneId: true, checkStatus: true },
          take: 1000,
        })
      : Promise.resolve([]),
    peerMilestoneIds.length
      ? db.peerReview.findMany({
          where: { reviewerId: userId, milestoneId: { in: peerMilestoneIds } },
          select: { milestoneId: true, revieweeId: true },
          take: 2000,
        })
      : Promise.resolve([]),
    saesWithoutSlot.length
      ? db.defenseSlot.findMany({
          where: { saeId: { in: saesWithoutSlot }, groupId: null, startsAt: { gte: now } },
          select: { saeId: true, startsAt: true },
          orderBy: { startsAt: "asc" },
          take: 300,
        })
      : Promise.resolve([]),
  ]);

  const items: StudentItem[] = [];

  for (const m of milestones) {
    const group = groupBySae.get(m.saeId);
    if (!group) continue;
    const assessment = assessments.find((a) => a.milestoneId === m.id) ?? null;
    const myLinks = links.filter((l) => l.milestoneId === m.id && l.groupId === group.id);
    const teammateIds = group.members.map((x) => x.userId).filter((id) => id !== userId);
    const reviewedIds = reviews.filter((r) => r.milestoneId === m.id).map((r) => r.revieweeId);
    const hasCriteria = m._count.criteria > 0;
    const progress = milestoneProgress({
      hasCriteria,
      requiresDepositUrl: m.requiresDepositUrl,
      peerReviewEnabled: m.peerReviewEnabled,
      assessmentStatus: assessment?.status ?? null,
      depositCount: myLinks.length,
      teammateIds,
      reviewedIds,
    });
    const problem = linkProblem(myLinks.map((l) => l.checkStatus));
    // Échéance passée et tout est fait : rien à signaler
    if (m.dueAt && m.dueAt < now && progress.done && !problem) continue;

    items.push({
      kind: "milestone",
      key: `m-${m.id}`,
      due: m.dueAt,
      sae: group.sae,
      milestoneId: m.id,
      title: m.title,
      groupId: group.id,
      progress,
      hasCriteria,
      assessment: {
        id: assessment?.id ?? null,
        status: assessment?.status ?? null,
        feedbackPublished: !!assessment?.feedbackPublishedAt,
      },
      deposit: { required: m.requiresDepositUrl, count: myLinks.length, problem },
      peer: { enabled: m.peerReviewEnabled, pending: progress.peerPending },
    });
  }

  for (const g of groups) {
    if (g.defenseSlot && g.defenseSlot.startsAt >= now) {
      items.push({
        kind: "defense",
        key: `d-${g.defenseSlot.id}`,
        due: g.defenseSlot.startsAt,
        sae: g.sae,
        groupId: g.id,
        groupName: g.name,
        durationMin: g.defenseSlot.durationMin,
        location: g.defenseSlot.location,
      });
    }
  }

  for (const saeId of saesWithoutSlot) {
    const slots = freeSlots.filter((s) => s.saeId === saeId);
    const group = groupBySae.get(saeId);
    if (slots.length === 0 || !group) continue;
    items.push({ kind: "booking", key: `b-${saeId}`, due: slots[0].startsAt, sae: group.sae, freeSlots: slots.length });
  }

  return { hasGroups: true, items };
}

// ─────────────────────────────────────────────────────────────
// Équipe pédagogique
// ─────────────────────────────────────────────────────────────

const LIST_TAKE = 20;

export async function loadStaffTodo(userId: string, now: Date) {
  // SAÉ gérées explicitement (responsable ou co-enseignant) — y compris pour un administrateur
  const saes = await db.sae.findMany({
    where: { OR: [{ ownerId: userId }, { teachers: { some: { id: userId } } }] },
    select: saeSelect,
    take: 200,
  });
  const saeIds = saes.map((s) => s.id);
  const hasSaes = saeIds.length > 0;
  const courseFilter = { OR: [{ ownerId: userId }, { editors: { some: { id: userId } } }] };
  const questionWhere = { resolved: false, answers: { none: {} }, page: { course: courseFilter } };
  const linkWhere = { checkStatus: { in: ["PRIVATE" as const, "BROKEN" as const] }, group: { saeId: { in: saeIds } } };
  const showcaseWhere = { saeId: { in: saeIds }, showcaseStatus: "PENDING" as const };
  const defenseHorizon = new Date(now.getTime() + 14 * DAY_MS);

  const [pendingGroups, links, linkCount, showcases, showcaseCount, questions, questionCount, defenses] = await Promise.all([
    hasSaes
      ? db.selfAssessment.groupBy({
          by: ["milestoneId"],
          where: { status: "SUBMITTED", feedbackPublishedAt: null, milestone: { saeId: { in: saeIds } } },
          _count: { _all: true },
          _min: { submittedAt: true },
        })
      : Promise.resolve([]),
    hasSaes
      ? db.depositLink.findMany({
          where: linkWhere,
          select: {
            id: true,
            url: true,
            label: true,
            checkStatus: true,
            checkNote: true,
            checkedAt: true,
            group: { select: { id: true, name: true, sae: { select: saeSelect } } },
            milestone: { select: { title: true } },
          },
          orderBy: [{ checkedAt: "desc" }, { id: "asc" }],
          take: LIST_TAKE,
        })
      : Promise.resolve([]),
    hasSaes ? db.depositLink.count({ where: linkWhere }) : Promise.resolve(0),
    hasSaes
      ? db.group.findMany({
          where: showcaseWhere,
          select: { id: true, name: true, showcaseTitle: true, updatedAt: true, sae: { select: saeSelect } },
          orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
          take: LIST_TAKE,
        })
      : Promise.resolve([]),
    hasSaes ? db.group.count({ where: showcaseWhere }) : Promise.resolve(0),
    db.pageQuestion.findMany({
      where: questionWhere,
      select: {
        id: true,
        body: true,
        createdAt: true,
        page: { select: { id: true, title: true, course: { select: { slug: true, title: true } } } },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: LIST_TAKE,
    }),
    db.pageQuestion.count({ where: questionWhere }),
    hasSaes
      ? db.defenseSlot.findMany({
          where: { saeId: { in: saeIds }, groupId: { not: null }, startsAt: { gte: now, lte: defenseHorizon } },
          select: {
            id: true,
            startsAt: true,
            durationMin: true,
            location: true,
            sae: { select: saeSelect },
            group: { select: { id: true, name: true } },
          },
          orderBy: { startsAt: "asc" },
          take: LIST_TAKE,
        })
      : Promise.resolve([]),
  ]);

  const pendingMilestones = pendingGroups.length
    ? await db.milestone.findMany({
        where: { id: { in: pendingGroups.map((g) => g.milestoneId) } },
        select: { id: true, title: true, dueAt: true, sae: { select: saeSelect } },
        take: 200,
      })
    : [];

  const toReview = pendingGroups
    .flatMap((g) => {
      const milestone = pendingMilestones.find((m) => m.id === g.milestoneId);
      return milestone ? [{ milestone, count: g._count._all, oldest: g._min.submittedAt }] : [];
    })
    .sort((a, b) => (a.oldest?.getTime() ?? 0) - (b.oldest?.getTime() ?? 0));

  return {
    hasSaes,
    toReview,
    toReviewTotal: toReview.reduce((n, r) => n + r.count, 0),
    links,
    linkCount,
    showcases,
    showcaseCount,
    questions,
    questionCount,
    defenses,
  };
}
