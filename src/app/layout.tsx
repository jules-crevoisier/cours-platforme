import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/session";
import { getTheme } from "@/lib/theme";
import "./globals.css";

// Une seule famille, variable (graisse + largeur) : titres élargis, texte normal ; next/font l'auto-héberge.
const sans = Archivo({ variable: "--ff-sans", subsets: ["latin"], axes: ["wdth"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Cours & SAÉ — BUT MMI", template: "%s — Cours & SAÉ" },
  description: "Cours, sujets de SAÉ, jalons et auto-évaluations du département MMI.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [user, theme] = await Promise.all([getCurrentUser(), getTheme()]);

  return (
    <html lang="fr" data-theme={theme} className={`${sans.variable} antialiased`}>
      <head>
        <meta name="theme-color" content={theme === "dark" ? "#171717" : "#ffffff"} />
      </head>
      <body className="min-h-[100dvh]">
        <a href="#contenu" className="skip-link">
          Aller au contenu
        </a>
        {user ? (
          <AppShell user={user} theme={theme}>
            {children}
          </AppShell>
        ) : (
          <div className="flex min-h-[100dvh] flex-col">
            <SiteHeader />
            <main id="contenu" tabIndex={-1} className="public-main mx-auto w-full max-w-6xl flex-1 py-10 outline-none md:py-16">
              {children}
            </main>
            <SiteFooter />
          </div>
        )}
      </body>
    </html>
  );
}
