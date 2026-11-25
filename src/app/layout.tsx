import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/session";
import { getTheme } from "@/lib/theme";
import "./globals.css";

// Une seule famille, variable (graisse) ; next/font l'auto-héberge.
const sans = Plus_Jakarta_Sans({ variable: "--ff-sans", subsets: ["latin"], display: "swap" });
// Texte de cours : Inter, plus neutre et plus léger à la lecture que la police de l'interface.
const read = Inter({ variable: "--ff-read", subsets: ["latin"], display: "swap" });

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
    <html lang="fr" data-theme={theme} className={`${sans.variable} ${read.variable} antialiased`}>
      <head>
        <meta name="theme-color" content={theme === "dark" ? "#16162a" : "#f6f6fb"} />
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
