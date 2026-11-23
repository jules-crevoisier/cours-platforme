import { redirect } from "next/navigation";
import { StaffTodo } from "@/app/_todo/staff-todo";
import { StudentTodo } from "@/app/_todo/student-todo";
import { StatusBadge } from "@/components/ui";
import { db } from "@/lib/db";
import { timeAgo } from "@/lib/format";
import { isStaff } from "@/lib/permissions";
import { getCurrentUser, type CurrentUser } from "@/lib/session";

const TZ = "Europe/Paris";

/** SAÉ de l'utilisateur (pour les annonces de SAÉ) : groupes (étudiant) ou SAÉ gérées (équipe pédagogique) */
async function mySaeIds(user: CurrentUser, staff: boolean): Promise<string[]> {
  if (staff) {
    const managed = await db.sae.findMany({
      where: { OR: [{ ownerId: user.id }, { teachers: { some: { id: user.id } } }] },
      select: { id: true },
      take: 50,
    });
    return managed.map((s) => s.id);
  }
  const memberships = await db.groupMember.findMany({
    where: { userId: user.id, group: { sae: { published: true } } },
    select: { group: { select: { saeId: true } } },
    take: 50,
  });
  return [...new Set(memberships.map((m) => m.group.saeId))];
}

function loadAnnouncements(user: CurrentUser, saeIds: string[]) {
  return db.announcement.findMany({
    where: {
      OR: [
        { scope: "GLOBAL" },
        { scope: "COHORT", cohort: { members: { some: { userId: user.id } } } },
        { scope: "SAE", saeId: { in: saeIds } },
        { scope: "COURSE", course: { OR: [{ ownerId: user.id }, { editors: { some: { id: user.id } } }] } },
      ],
    },
    select: {
      id: true,
      scope: true,
      title: true,
      body: true,
      pinned: true,
      createdAt: true,
      author: { select: { name: true } },
      cohort: { select: { name: true } },
      sae: { select: { code: true, title: true } },
      course: { select: { title: true } },
    },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: 5,
  });
}

type Announcement = Awaited<ReturnType<typeof loadAnnouncements>>[number];

/** Accueil : ce qu'il y a à faire, et les annonces. Visiteur non connecté → connexion. */
export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const now = new Date();
  const staff = isStaff(user);
  const announcements = await loadAnnouncements(user, await mySaeIds(user, staff));

  const firstName = user.name.trim().split(/\s+/)[0] || user.name;
  const hour = Number(new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(now));
  const greeting = hour >= 18 || hour < 5 ? "Bonsoir" : "Bonjour";

  return (
    <div className="flex flex-col gap-10">
      <h1 className="text-3xl break-words md:text-4xl">
        {greeting} {firstName}
      </h1>

      <div className="grid gap-12 xl:grid-cols-[minmax(0,1fr)_20rem] xl:gap-16">
        <section aria-labelledby="a-faire" className="flex min-w-0 flex-col gap-6">
          <h2 id="a-faire" className="text-xl">
            À faire
          </h2>
          {staff ? <StaffTodo userId={user.id} now={now} /> : <StudentTodo userId={user.id} now={now} />}
        </section>

        <Announcements items={announcements} now={now} />
      </div>
    </div>
  );
}

const BODY_PREVIEW = 280;

function scopeLabel(a: Announcement) {
  if (a.scope === "COHORT") return a.cohort?.name ?? "Promo";
  if (a.scope === "SAE") return a.sae?.code ?? a.sae?.title ?? "SAÉ";
  if (a.scope === "COURSE") return a.course?.title ?? "Cours";
  return "Département";
}

function Announcements({ items, now }: { items: Announcement[]; now: Date }) {
  return (
    <section aria-labelledby="annonces" className="flex min-w-0 flex-col gap-6">
      <h2 id="annonces" className="text-xl">
        Annonces
      </h2>
      {items.length === 0 ? (
        <p className="text-muted">Aucune annonce.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line border-y border-line">
          {items.map((a) => {
            const cut = a.body.length > BODY_PREVIEW ? a.body.lastIndexOf(" ", BODY_PREVIEW) : -1;
            const head = cut > 0 ? a.body.slice(0, cut) : a.body;
            const rest = cut > 0 ? a.body.slice(cut + 1) : "";
            return (
              <li key={a.id} className="flex flex-col gap-1.5 py-4">
                {a.pinned && <StatusBadge tone="accent">Épinglée</StatusBadge>}
                <h3 className="text-base break-words">{a.title}</h3>
                <p className="break-words whitespace-pre-line">
                  {head}
                  {rest && "…"}
                </p>
                {rest && (
                  <details className="group">
                    <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-accent hover:underline">
                      <span className="group-open:hidden">Lire la suite</span>
                      <span className="hidden group-open:inline">Réduire</span>
                    </summary>
                    <p className="break-words whitespace-pre-line">{rest}</p>
                  </details>
                )}
                <p className="flex flex-wrap gap-x-4 text-sm text-muted">
                  <span>{scopeLabel(a)}</span>
                  <span>{a.author.name}</span>
                  <time dateTime={a.createdAt.toISOString()}>{timeAgo(a.createdAt, now)}</time>
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
