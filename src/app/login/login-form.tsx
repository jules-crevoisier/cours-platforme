"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

function loginErrorMessage(status: number, message?: string) {
  if (status === 401 || status === 400)
    return "E-mail ou mot de passe incorrect.";
  if (status === 403) return message ?? "Connexion refusée.";
  if (status === 429) return "Trop de tentatives. Réessayez dans une minute.";
  return "Connexion impossible pour le moment. Réessayez plus tard.";
}

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // Champ en erreur (WCAG 3.3.1) : relié au message et focalisé
  const [invalid, setInvalid] = useState<"email" | "password" | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (!email || !password) {
      const field = !email ? "email" : "password";
      setInvalid(field);
      setError(
        !email
          ? "Renseignez votre adresse e-mail."
          : "Renseignez votre mot de passe.",
      );
      document.getElementById(`login-${field}`)?.focus();
      return;
    }
    setInvalid(null);

    setPending(true);
    setError(null);
    try {
      const { error: authError } = await authClient.signIn.email({
        email,
        password,
      });
      if (authError) {
        setError(loginErrorMessage(authError.status, authError.message));
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Connexion impossible : vérifiez votre connexion réseau.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <div>
        <label htmlFor="login-email" className="label">
          E-mail
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="input"
          aria-invalid={invalid === "email" || undefined}
          aria-describedby={error ? "login-error" : undefined}
        />
      </div>
      <div>
        <label htmlFor="login-password" className="label">
          Mot de passe
        </label>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="input"
          aria-invalid={invalid === "password" || undefined}
          aria-describedby={error ? "login-error" : undefined}
        />
      </div>
      {error && (
        <p id="login-error" role="alert" className="form-error">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Connexion…" : "Se connecter"}
      </button>
      <p className="text-sm text-muted">
        Pas encore de compte ?{" "}
        <Link
          href="/register"
          className="link inline-flex min-h-11 items-center"
        >
          Créer un compte
        </Link>
      </p>
    </form>
  );
}
