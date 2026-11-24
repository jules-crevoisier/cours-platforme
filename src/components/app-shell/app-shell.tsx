import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { SignOutButton } from "@/components/sign-out-button";
import { toggleTheme } from "@/app/_actions/theme";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import type { CurrentUser } from "@/lib/session";
import type { Theme } from "@/lib/theme";
import { getFavorites, getUnreadCount } from "./data";
import { MAIN_ITEMS, accountItems, initials, navSections, railItems } from "./nav";
import { Rail } from "./rail";
import { ContentFooter, FavoritesNav, NotificationBell, Wordmark } from "./parts";
import { PopoverPanel } from "./popover-panel";
import { SearchField } from "./search-field";
import { SideNav } from "./side-nav";
import { TabBar } from "./tab-bar";

const MENU_ROW =
  "flex min-h-11 w-full cursor-pointer items-center gap-2.5 px-2.5 text-left text-sm text-ink transition-colors hover:bg-sunken pointer-fine:min-h-9";

/**
 * Coquille connectée.
 * ≥ 1024 px : barre latérale fixe 240 px (recherche, navigation, favoris) + menu du compte en bas.
 * < 1024 px : barre haute (logo, recherche, cloche, menu) + barre d'onglets basse + tiroir.
 */
export async function AppShell({ user, theme, children }: { user: CurrentUser; theme: Theme; children: ReactNode }) {
  const [favorites, unread] = await Promise.all([getFavorites(user.id), getUnreadCount(user.id)]);
  const sections = navSections(user.role);
  const extraSections = sections.filter((s) => s.id !== "principal");

  return (
    <div className="min-h-[100dvh] lg:pl-20 print:pl-0">
      {/* ── Rail d'icônes (≥ 1024 px) ── */}
      <div className="shell-sidebar fixed inset-y-0 left-0 z-20 hidden w-20 flex-col items-stretch border-r border-line bg-surface py-3 lg:flex">
        <Link href="/" className="mb-4 flex min-h-12 items-center justify-center" title="Accueil">
          <Wordmark labelClassName="hidden" />
          <span className="sr-only">Cours &amp; SAÉ — accueil</span>
        </Link>
        <Rail items={railItems(user.role)} />
      </div>

      {/* ── Barre haute (≥ 1024 px) : recherche, notifications, compte ── */}
      <header className="shell-topbar-d sticky top-0 z-10 hidden h-16 items-center gap-3 border-b border-line bg-surface/95 px-12 backdrop-blur lg:flex">
        <div className="w-full max-w-lg">
          <SearchField />
        </div>
        <div className="ml-auto flex items-center gap-1">
          <NotificationBell count={unread} className="rounded-lg hover:bg-sunken" />
          <button
            type="button"
            popoverTarget="menu-utilisateur"
            className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-2 text-left transition-colors hover:bg-sunken"
          >
            <Avatar name={user.name} />
            <span className="flex flex-col">
              <span className="text-sm leading-tight font-semibold">{user.name}</span>
              <span className="text-xs leading-tight text-muted">{ROLE_LABELS[user.role]}</span>
            </span>
            <Icon name="chevronRight" size={16} className="shrink-0 rotate-90 text-muted" />
            <span className="sr-only">Ouvrir le menu du compte</span>
          </button>
          <PopoverPanel id="menu-utilisateur" label="Compte" className="user-menu">
            <AccountLinks role={user.role} theme={theme} />
            {favorites.length > 0 && (
              <div className="mt-1 border-t border-line pt-2">
                <FavoritesNav favorites={favorites} id="favoris-menu" />
              </div>
            )}
          </PopoverPanel>
        </div>
      </header>

      {/* ── Barre haute (< 1024 px) ── */}
      <header className="shell-topbar sticky top-0 z-30 border-b border-line bg-surface lg:hidden">
        <div className="flex h-14 items-center gap-0.5">
          <Link href="/" className="mr-auto flex min-h-11 min-w-0 items-center px-2">
            <Wordmark />
            <span className="sr-only"> — accueil</span>
          </Link>
          <Link
            href="/search"
            aria-label="Rechercher"
            title="Rechercher"
            className="inline-flex size-11 shrink-0 items-center justify-center transition-colors hover:bg-sunken"
          >
            <Icon name="search" />
          </Link>
          <NotificationBell count={unread} className="hover:bg-sunken" />
          <button
            type="button"
            popoverTarget="menu-mobile"
            aria-label="Ouvrir le menu"
            title="Menu"
            className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center transition-colors hover:bg-sunken"
          >
            <Icon name="menu" />
          </button>
        </div>
      </header>

      <PopoverPanel id="menu-mobile" label="Menu" className="drawer lg:hidden">
        <div className="flex h-14 items-center justify-between border-b border-line pr-1 pl-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar name={user.name} />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold">{user.name}</span>
              <span className="text-xs text-muted">{ROLE_LABELS[user.role]}</span>
            </span>
          </div>
          <button
            type="button"
            popoverTarget="menu-mobile"
            popoverTargetAction="hide"
            aria-label="Fermer le menu"
            className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center hover:bg-sunken"
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="flex flex-col gap-6 px-3 py-4">
          {extraSections.length > 0 && <SideNav sections={extraSections} label="Menu complet" idPrefix="tiroir" />}
          <FavoritesNav favorites={favorites} id="favoris-tiroir" />
          <div className={extraSections.length > 0 || favorites.length > 0 ? "border-t border-line pt-3" : undefined}>
            <AccountLinks role={user.role} theme={theme} />
          </div>
        </div>
      </PopoverPanel>

      <main id="contenu" tabIndex={-1} className="shell-main pt-6 outline-none md:pt-8 lg:pt-8">
        <div className="w-full max-w-[96rem]">{children}</div>
        <ContentFooter className="max-w-[96rem]" />
      </main>

      <TabBar items={MAIN_ITEMS} />
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent text-xs font-bold"
    >
      {initials(name)}
    </span>
  );
}

function AccountLinks({ role, theme }: { role: Role; theme: Theme }) {
  return (
    <ul className="flex flex-col">
      {accountItems(role).map((item) => (
        <li key={item.href}>
          <Link href={item.href} className={MENU_ROW}>
            <Icon name={item.icon} size={18} className="shrink-0 text-muted" />
            {item.label}
          </Link>
        </li>
      ))}
      <li>
        <form action={toggleTheme}>
          <button type="submit" className={MENU_ROW}>
            <Icon name="contrast" size={18} className="shrink-0 text-muted" />
            {theme === "dark" ? "Thème clair" : "Thème sombre"}
          </button>
        </form>
      </li>
      <li className="mt-1 border-t border-line pt-1">
        <SignOutButton className={`${MENU_ROW} disabled:opacity-55`} withIcon />
      </li>
    </ul>
  );
}
