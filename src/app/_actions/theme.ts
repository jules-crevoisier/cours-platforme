"use server";

import { cookies } from "next/headers";
import { THEME_COOKIE, type Theme } from "@/lib/theme";

/** Bascule clair ↔ sombre ; le choix est gardé un an dans un cookie lu par le layout racine */
export async function toggleTheme() {
  const store = await cookies();
  const next: Theme = store.get(THEME_COOKIE)?.value === "dark" ? "light" : "dark";
  store.set(THEME_COOKIE, next, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}
