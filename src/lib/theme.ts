import "server-only";
import { cookies } from "next/headers";

export const THEME_COOKIE = "theme";
export type Theme = "light" | "dark";

/** Thème choisi dans le menu du compte ; clair par défaut (le réglage du système est ignoré) */
export async function getTheme(): Promise<Theme> {
  const store = await cookies();
  return store.get(THEME_COOKIE)?.value === "dark" ? "dark" : "light";
}
