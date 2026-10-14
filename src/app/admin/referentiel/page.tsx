import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { assertAllowed, requireUser } from "@/lib/session";
import { canManageReferentiel, isStaff } from "@/lib/permissions";
import { MMI_CRITICAL_LEARNINGS, MMI_PARCOURS } from "@/data/referentiel-mmi";
import { ActionForm, SubmitButton } from "@/app/saes/_components/action-form";
import { safeColor } from "@/app/saes/_lib/criteria";
import { createLocalLearning, deleteLearning, updateLearningLabel } from "./actions";

export const metadata: Metadata = { title: "Référentiel de compétences" };

const OFFICIAL = new Map(MMI_CRITICAL_LEARNINGS.map((l) => [l.code, l.label]));
const LEVELS = [1, 2, 3] as const;

function levelLabels(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

const plural = (n: number, singular: string, pluralForm = `${singular}s`) => `${n} ${n > 1 ? pluralForm : singular}`;

export default async function ReferentielPage() {
  const user = await requireUser();
  assertAllowed(isStaff(user));
  const canEdit = canManageReferentiel(user);

  const competences = await db.competence.findMany({
    orderBy: [{ position: "asc" }, { code: "asc" }],
    take: 20,
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      color: true,
      levelLabels: true,
      components: { orderBy: { code: "asc" }, take: 50, select: { id: true, code: true, label: true } },
      learnings: {
        orderBy: { code: "asc" },
        take: 300,
        select: {
          id: true,
          code: true,
          label: true,
          level: true,
          parcours: true,
          _count: { select: { criteria: true, evidences: true } },
        },
      },
    },
  });
  const total = competences.reduce((sum, c) => sum + c.learnings.length, 0);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="eyebrow">Administration</p>
        <h1 className="text-2xl font-semibold text-balance">Référentiel de compétences — BUT MMI</h1>
        <p className="max-w-prose text-muted">
          Compétences, composantes essentielles (CE) et apprentissages critiques (AC) utilisés par les critères des
          SAÉ et les portfolios. {canEdit ? "Vous pouvez adapter les libellés et ajouter des AC locaux." : "Lecture seule."}
        </p>
        <p className="font-mono text-sm text-muted">
          {plural(competences.length, "compétence")} · {total} AC
        </p>
        <p>
          <Link href="/admin/referentiel/couverture" className="underline">
            Voir la couverture des AC par les SAÉ →
          </Link>
        </p>
      </header>

      {competences.length === 0 ? (
        <p className="card text-muted">
          Le référentiel n&apos;est pas encore chargé en base. Lancez <span className="font-mono">npm run db:seed</span>{" "}
          pour importer le programme national MMI.
        </p>
      ) : (
        <ol className="space-y-4">
          {competences.map((c) => {
            const labels = levelLabels(c.levelLabels);
            return (
              <li key={c.id}>
                <details className="card group" open={competences.length <= 1}>
                  <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
                    <span
                      aria-hidden="true"
                      className="inline-block size-3 shrink-0 rounded-full bg-muted"
                      style={{ backgroundColor: safeColor(c.color) }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="font-mono text-sm text-muted">{c.code}</span>{" "}
                      <span className="font-semibold">{c.name}</span>
                      {c.description && <span className="block text-sm text-muted">{c.description}</span>}
                    </span>
                    <span className="font-mono text-xs text-muted">{c.learnings.length} AC</span>
                    <span aria-hidden="true" className="transition-transform group-open:rotate-180">
                      ▾
                    </span>
                  </summary>

                  <div className="mt-4 space-y-5 border-t border-line pt-4">
                    {c.components.length > 0 && (
                      <div>
                        <h3 className="eyebrow">Composantes essentielles</h3>
                        <ul className="mt-2 space-y-1 text-sm">
                          {c.components.map((ce) => (
                            <li key={ce.id} className="break-words">
                              <span className="mr-2 font-mono text-xs text-muted">{ce.code}</span>
                              {ce.label}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {LEVELS.map((level) => {
                      const learnings = c.learnings.filter((l) => l.level === level);
                      if (learnings.length === 0) return null;
                      return (
                        <div key={level}>
                          <h3 className="font-medium">
                            Niveau {level}
                            {labels[level - 1] && <span className="font-normal text-muted"> — {labels[level - 1]}</span>}
                          </h3>
                          <ul className="mt-2 divide-y divide-line">
                            {learnings.map((l) => {
                              const official = OFFICIAL.get(l.code);
                              const used = l._count.criteria + l._count.evidences;
                              return (
                                <li key={l.id} className="space-y-2 py-3">
                                  <p className="break-words">
                                    <span className="badge mr-2 font-mono">{l.code}</span>
                                    {l.label}
                                  </p>
                                  <p className="flex flex-wrap gap-2 text-xs">
                                    {!official && <span className="badge badge-accent">AC local</span>}
                                    {official && official !== l.label && (
                                      <span className="badge badge-warn" title={`Libellé national : ${official}`}>
                                        Libellé adapté
                                      </span>
                                    )}
                                    {l.parcours && <span className="badge">Parcours {l.parcours}</span>}
                                    <span className="badge">{plural(l._count.criteria, "critère")}</span>
                                    <span className="badge">{plural(l._count.evidences, "trace")}</span>
                                  </p>
                                  {canEdit && (
                                    <div className="flex flex-wrap items-start gap-2">
                                      <details className="group/edit">
                                        <summary className="btn cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                                          Modifier le libellé
                                        </summary>
                                        <ActionForm
                                          action={updateLearningLabel}
                                          className="mt-3 space-y-2"
                                          aria-label={`Modifier ${l.code}`}
                                        >
                                          <input type="hidden" name="learningId" value={l.id} />
                                          <label htmlFor={`label-${l.id}`} className="label">
                                            Libellé de {l.code}
                                          </label>
                                          <textarea
                                            id={`label-${l.id}`}
                                            name="label"
                                            className="input py-2"
                                            rows={2}
                                            required
                                            maxLength={1000}
                                            defaultValue={l.label}
                                          />
                                          {official && official !== l.label && (
                                            <p className="text-xs text-muted">Libellé national : {official}</p>
                                          )}
                                          <SubmitButton pendingLabel="Enregistrement…">Enregistrer</SubmitButton>
                                        </ActionForm>
                                      </details>
                                      {used === 0 ? (
                                        <ActionForm
                                          action={deleteLearning}
                                          quiet
                                          confirmMessage={`Supprimer ${l.code} du référentiel ?`}
                                        >
                                          <input type="hidden" name="learningId" value={l.id} />
                                          <SubmitButton className="btn btn-danger" pendingLabel="Suppression…">
                                            Supprimer
                                          </SubmitButton>
                                        </ActionForm>
                                      ) : (
                                        <span className="self-center text-xs text-muted">
                                          Utilisé : suppression impossible
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                </details>
              </li>
            );
          })}
        </ol>
      )}

      {canEdit && competences.length > 0 && (
        <section aria-labelledby="ajout-ac" className="space-y-3">
          <h2 id="ajout-ac" className="text-xl font-semibold">
            Ajouter un AC local
          </h2>
          <ActionForm action={createLocalLearning} resetOnSuccess className="card space-y-4" aria-label="Ajouter un AC local">
            <div className="grid gap-4 md:grid-cols-[12rem_minmax(0,1fr)]">
              <div>
                <label htmlFor="ac-code" className="label">
                  Code
                </label>
                <input
                  id="ac-code"
                  name="code"
                  required
                  maxLength={7}
                  pattern="[Aa][Cc][1-3][1-5]\.\d{2}"
                  placeholder="AC24.07"
                  autoComplete="off"
                  aria-describedby="ac-code-hint"
                  className="input font-mono uppercase"
                />
              </div>
              <div>
                <label htmlFor="ac-parcours" className="label">
                  Parcours
                </label>
                <select id="ac-parcours" name="parcours" className="input" defaultValue="">
                  <option value="">Tronc commun</option>
                  {MMI_PARCOURS.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <p id="ac-code-hint" className="text-xs text-muted md:col-span-2">
                AC + niveau (1 à 3) + compétence (1 à 5) + « . » + numéro : AC24.07 = niveau 2, C4 Développer.
              </p>
              <div className="md:col-span-2">
                <label htmlFor="ac-label" className="label">
                  Libellé
                </label>
                <textarea id="ac-label" name="label" required maxLength={1000} rows={2} className="input py-2" />
              </div>
            </div>
            <SubmitButton pendingLabel="Ajout…">Ajouter l&apos;AC</SubmitButton>
          </ActionForm>
        </section>
      )}
    </div>
  );
}
