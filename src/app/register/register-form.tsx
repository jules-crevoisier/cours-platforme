"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

const MIN_PASSWORD = 10;

function registerErrorMessage(status: number, code?: string, message?: string) {
  if (code === "USER_ALREADY_EXISTS" || status === 422)
    return "Un compte existe déjà avec cette adresse e-mail.";
  if (code === "PASSWORD_TOO_SHORT")
    return `Le mot de passe doit contenir au moins ${MIN_PASSWORD} caractères.`;
  if (code === "INVALID_EMAIL") return "Adresse e-mail invalide.";
  if (status === 429) return "Trop de tentatives. Réessayez dans une minute.";
  // 403 : restriction de domaine — message déjà rédigé en français côté serveur
  if (status === 403 && message) return message;
  return (
    message ?? "Inscription impossible pour le moment. Réessayez plus tard."
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<"name" | "email" | "password" | null>(
    null,
  );
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    const fail = (field: "name" | "email" | "password", message: string) => {
      setInvalid(field);
      setError(message);
      document.getElementById(`register-${field}`)?.focus();
    };
    if (!name) return fail("name", "Indiquez votre nom.");
    if (!email) return fail("email", "Indiquez votre adresse e-mail.");
    if (password.length < MIN_PASSWORD) {
      return fail(
        "password",
        `Le mot de passe doit contenir au moins ${MIN_PASSWORD} caractères.`,
      );
    }
    setInvalid(null);

    setPending(true);
    setError(null);
    try {
      const { error: authError } = await authClient.signUp.email({
        name,
        email,
        password,
      });
      if (authError) {
        setError(
          registerErrorMessage(
            authError.status,
            authError.code,
            authError.message,
          ),
        );
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Inscription impossible : vérifiez votre connexion réseau.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <div>
        <label htmlFor="register-name" className="label">
          Nom complet
        </label>
        <input
          id="register-name"
          name="name"
          autoComplete="name"
          required
          maxLength={120}
          className="input"
          aria-invalid={invalid === "name" || undefined}
          aria-describedby={error ? "register-error" : undefined}
        />
      </div>
      <div>
        <label htmlFor="register-email" className="label">
          E-mail
        </label>
        <input
          id="register-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="input"
          aria-invalid={invalid === "email" || undefined}
          aria-describedby={error ? "register-error" : undefined}
        />
      </div>
      <div>
        <label htmlFor="register-password" className="label">
          Mot de passe
        </label>
        <input
          id="register-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD}
          aria-describedby={
            error
              ? "register-password-hint register-error"
              : "register-password-hint"
          }
          aria-invalid={invalid === "password" || undefined}
          className="input"
        />
        <p id="register-password-hint" className="mt-1 text-sm text-muted">
          Au moins {MIN_PASSWORD} caractères.
        </p>
      </div>
      {error && (
        <p id="register-error" role="alert" className="form-error">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Création du compte…" : "Créer mon compte"}
      </button>
      <p className="text-sm text-muted">
        Déjà un compte ?{" "}
        <Link href="/login" className="link inline-flex min-h-11 items-center">
          Se connecter
        </Link>
      </p>
    </form>
  );
}
