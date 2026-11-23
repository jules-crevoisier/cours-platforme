// Formatage commun (fr-FR, fuseau Europe/Paris quel que soit le serveur).

const TZ = "Europe/Paris";

export function formatDate(d: Date) {
  return d.toLocaleDateString("fr-FR", { timeZone: TZ, day: "numeric", month: "long", year: "numeric" });
}

export function formatDateShort(d: Date) {
  return d.toLocaleDateString("fr-FR", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
}

export function formatDateTime(d: Date) {
  return d.toLocaleString("fr-FR", {
    timeZone: TZ,
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(d: Date) {
  return d.toLocaleTimeString("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
}

/** Jour calendaire à Paris, pour compter les jours sans erreur de fuseau */
function parisDay(d: Date) {
  const [y, m, day] = d.toLocaleDateString("en-CA", { timeZone: TZ }).split("-").map(Number);
  return Date.UTC(y, m - 1, day);
}

export type DeadlineTone = "overdue" | "soon" | "later" | "done";

/**
 * Échéance en une seule information : "En retard", "Aujourd'hui", "Demain", "Dans 3 jours",
 * puis la date courte ("16 oct.") au-delà d'une semaine.
 * soon = moins de 72 h (à mettre en avant), overdue = dépassée.
 */
export function deadline(due: Date, now = new Date(), done = false): { label: string; tone: DeadlineTone } {
  if (done) return { label: "Fait", tone: "done" };
  const ms = due.getTime() - now.getTime();
  if (ms < 0) return { label: "En retard", tone: "overdue" };
  const days = Math.round((parisDay(due) - parisDay(now)) / 86_400_000);
  const tone: DeadlineTone = ms <= 72 * 3600 * 1000 ? "soon" : "later";
  if (days === 0) return { label: "Aujourd'hui", tone };
  if (days === 1) return { label: "Demain", tone };
  if (days < 7) return { label: `Dans ${days} jours`, tone };
  return { label: due.toLocaleDateString("fr-FR", { timeZone: TZ, day: "numeric", month: "short" }), tone };
}

/** « il y a 3 min », « il y a 2 j » */
export function timeAgo(d: Date, now = new Date()) {
  const s = Math.max(0, Math.round((now.getTime() - d.getTime()) / 1000));
  if (s < 60) return "à l'instant";
  const m = Math.round(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.round(h / 24);
  if (j < 30) return `il y a ${j} j`;
  return `le ${formatDate(d)}`;
}
