import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { PROVIDER_BUTTONS, enabledProviders } from "@/lib/auth-providers";
import { getCurrentUser } from "@/lib/session";
import { ExternalProviders, type ExternalProvider } from "./external-providers";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

/** Derniers projets publiés en vitrine avec un visuel (la vitrine est publique) */
async function latestProjects() {
  try {
    return await db.group.findMany({
      where: { showcaseStatus: "PUBLISHED", showcaseImageUrl: { startsWith: "https://" } },
      orderBy: { updatedAt: "desc" },
      take: 4,
      select: { id: true, name: true, showcaseTitle: true, showcaseImageUrl: true },
    });
  } catch (e) {
    console.error("Connexion : vitrine indisponible", e);
    return [];
  }
}

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");

  // Uniquement les fournisseurs activés (AUTH_PROVIDERS) ; aucun bouton « bientôt disponible »
  const external: ExternalProvider[] = enabledProviders
    .filter((p): p is ExternalProvider["id"] => p !== "credentials")
    .map((id) => ({
      id,
      label: PROVIDER_BUTTONS[id],
      providerId: id === "oidc" ? (process.env.OIDC_PROVIDER_ID ?? "oidc") : "cas",
    }));
  const projects = await latestProjects();

  return (
    <div className="grid gap-16 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-center lg:gap-24">
      <div className="flex min-w-0 flex-col gap-8">
        <h1 className="text-4xl">Connexion</h1>
        {external.length > 0 && (
          <>
            <ExternalProviders providers={external} />
            <p className="flex items-center gap-3 text-sm text-muted before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
              ou
            </p>
          </>
        )}
        <LoginForm />
      </div>

      {projects.length > 0 ? (
        <section aria-labelledby="projets" className="hidden flex-col gap-4 lg:flex">
          <h2 id="projets" className="sr-only">
            Projets étudiants
          </h2>
          <ul className="grid grid-cols-2 gap-4">
            {projects.map((p) => (
              <li key={p.id}>
                <Link href="/vitrine" className="group flex flex-col gap-2">
                  {/* Visuel externe fourni par le groupe : pas d'optimisation Next, pas de référent */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.showcaseImageUrl!}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className="aspect-square w-full border border-line bg-sunken object-cover"
                  />
                  <span className="truncate text-sm text-muted group-hover:text-ink group-hover:underline">
                    {p.showcaseTitle || p.name}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <Squares />
      )}
    </div>
  );
}

/** Composition décorative de carrés aux couleurs des compétences (quand la vitrine est vide) */
function Squares() {
  const cells = ["--accent", "--sunken", "--c3", "--c1", "--ink", "--sunken", "--c4", "--accent", "--c5", "--sunken", "--c2", "--accent"];
  return (
    <div aria-hidden="true" className="hidden grid-cols-4 gap-3 lg:grid">
      {cells.map((c, i) => (
        <span key={i} className="aspect-square" style={{ background: `var(${c})` }} />
      ))}
    </div>
  );
}
