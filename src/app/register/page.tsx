import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Inscription" };

/** Inscription : même gabarit que la connexion (une colonne étroite, titre, formulaire) */
export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/");

  return (
    <div className="flex w-full max-w-sm min-w-0 flex-col gap-8">
      <h1 className="text-4xl">Créer un compte</h1>
      <RegisterForm />
    </div>
  );
}
