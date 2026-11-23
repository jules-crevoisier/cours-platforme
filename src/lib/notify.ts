import "server-only";
import { db } from "@/lib/db";

export type NotificationType =
  | "comment"
  | "feedback"
  | "announcement"
  | "question"
  | "answer"
  | "defense"
  | "showcase"
  | "reopen";

type Payload = {
  type: NotificationType;
  title: string;
  body?: string;
  /** Chemin interne commençant par "/" */
  link?: string;
};

/**
 * Crée une notification in-app pour chaque destinataire (sans doublon, jamais pour l'auteur).
 * Ne lève jamais : une notification ratée ne doit pas faire échouer l'action métier.
 */
export async function notify(userIds: Iterable<string>, payload: Payload, exceptUserId?: string) {
  const ids = [...new Set(userIds)].filter((id) => id && id !== exceptUserId);
  if (ids.length === 0) return;
  const link = payload.link?.startsWith("/") ? payload.link : undefined;
  try {
    await db.notification.createMany({
      data: ids.map((userId) => ({
        userId,
        type: payload.type,
        title: payload.title.slice(0, 190),
        body: payload.body?.slice(0, 2000),
        link,
      })),
    });
  } catch (e) {
    console.error("notify() a échoué", e);
  }
}

export function unreadNotificationCount(userId: string) {
  return db.notification.count({ where: { userId, readAt: null } });
}

/**
 * Marque comme lues les notifications non lues qui pointent vers une page que l'utilisateur vient d'ouvrir.
 * Ne lève jamais : appelée après le rendu, elle ne doit pas casser la page.
 */
export async function markNotificationsReadByLink(userId: string, link: string) {
  try {
    await db.notification.updateMany({ where: { userId, link, readAt: null }, data: { readAt: new Date() } });
  } catch (e) {
    console.error("markNotificationsReadByLink() a échoué", e);
  }
}

/** Destinataires « équipe pédagogique » d'une SAÉ : responsable + co-enseignants */
export async function saeStaffIds(saeId: string) {
  const sae = await db.sae.findUnique({
    where: { id: saeId },
    select: { ownerId: true, teachers: { select: { id: true } } },
  });
  return sae ? [sae.ownerId, ...sae.teachers.map((t) => t.id)] : [];
}
