import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { assertAllowed, requireUser } from "@/lib/session";
import { canManageReferentiel, isStaff } from "@/lib/permissions";
import { MMI_CRITICAL_LEARNINGS, MMI_PARCOURS } from "@/data/referentiel-mmi";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui";
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
    <div className="flex flex-col gap-10">
      <PageHeader
        title="Référentiel de compétences"
        actions={
          <Link href="/admin/referentiel/couverture" className="btn">
            Couverture des AC
          </Link>
        }
        meta={
          competences.length > 0 ? (
            <>
              <span>BUT MMI</span>
              <span>{plural(competences.length, "compétence")}</span>
              <span>{total} AC</span>
            </>
          ) : undefined
        }
      />

      {competences.length === 0 ? (
        <EmptyState>Référentiel vide.</EmptyState>
      ) : (
        <ol className="divide-y divide-line border-y border-line">
          {competences.map((c) => {
            const labels = levelLabels(c.levelLabels);
            return (
              <li key={c.id}>
                <details className="group" open={competences.length <= 1}>
                  <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 py-3 [&::-webkit-details-marker]:hidden">
                    <span aria-hidden="true" className="inline-block size-3 shrink-0 bg-muted" style={{ backgroundColor: safeColor(c.color) }} />
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold">
                        {c.code} {c.name}
                      </span>
                      {c.description && <span className="block text-sm text-muted">{c.description}</span>}
                    </span>
                    <span className="text-sm text-muted">{c.learnings.length} AC</span>
                    <span aria-hidden="true" className="transition-transform group-open:rotate-180">
                      ▾
                    </span>
                  </summary>

                  <div className="flex flex-col gap-6 pt-2 pb-6 sm:pl-6">
                    {c.components.length > 0 && (
                      <div>
                        <h3 className="text-base">Composantes essentielles</h3>
                        <ul className="mt-2 flex flex-col gap-1 text-sm">
                          {c.components.map((ce) => (
                            <li key={ce.id} className="break-words">
                              <span className="mr-2 font-semibold">{ce.code}</span>
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
                          <h3 className="flex flex-wrap gap-x-3 text-base">
                            <span>Niveau {level}</span>
                            {labels[level - 1] && <span className="font-normal text-muted">{labels[level - 1]}</span>}
                          </h3>
                          <ul className="mt-2 divide-y divide-line">
                            {learnings.map((l) => {
                              const official = OFFICIAL.get(l.code);
                              const adapted = !!official && official !== l.label;
                              const used = l._count.criteria + l._count.evidences;
                              return (
                                <li key={l.id} className="flex flex-col gap-2 py-3">
                                  <p className="break-words">
                                    <span className="mr-2 font-semibold">{l.code}</span>
                                    {l.label}
                                  </p>
                                  <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                                    {/* Un seul badge : AC local ou libellé adapté (exclusifs) */}
                                    {!official && <StatusBadge>AC local</StatusBadge>}
                                    {adapted && <StatusBadge tone="warn">Libellé adapté</StatusBadge>}
                                    {l.parcours && <span>Parcours {l.parcours}</span>}
                                    <span>{plural(l._count.criteria, "critère")}</span>
                                    <span>{plural(l._count.evidences, "trace")}</span>
                                  </p>
                                  {canEdit && (
                                    <div className="flex flex-wrap items-start gap-2">
                                      <details>
                                        <summary className="btn cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                                          Modifier le libellé
                                        </summary>
                                        <ActionForm
                                          action={updateLearningLabel}
                                          className="mt-3 flex flex-col items-start gap-2"
                                          aria-label={`Modifier ${l.code}`}
                                        >
                                          <input type="hidden" name="learningId" value={l.id} />
                                          <label htmlFor={`label-${l.id}`} className="label">
                                            Libellé de {l.code}
                                          </label>
                                          <textarea
                                            id={`label-${l.id}`}
                                            name="label"
                                            className="input"
                                            rows={2}
                                            required
                                            maxLength={1000}
                                            defaultValue={l.label}
                                          />
                                          {adapted && <p className="text-sm text-muted">Libellé national : {official}</p>}
                                          <SubmitButton pendingLabel="Enregistrement…">Enregistrer</SubmitButton>
                                        </ActionForm>
                                      </details>
                                      {used === 0 && (
                                        <ActionForm action={deleteLearning} quiet confirmMessage={`Supprimer ${l.code} du référentiel ?`}>
                                          <input type="hidden" name="learningId" value={l.id} />
                                          <SubmitButton className="btn btn-danger" pendingLabel="Suppression…">
                                            Supprimer
                                          </SubmitButton>
                                        </ActionForm>
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
        <section aria-labelledby="ajout-ac" className="flex flex-col gap-4">
          <h2 id="ajout-ac" className="text-xl">
            Ajouter un AC local
          </h2>
          <ActionForm action={createLocalLearning} resetOnSuccess className="flex max-w-3xl flex-col gap-4" aria-label="Ajouter un AC local">
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
                  className="input"
                />
                <p id="ac-code-hint" className="mt-1 text-sm text-muted">
                  Format AC24.07
                </p>
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
              <div className="md:col-span-2">
                <label htmlFor="ac-label" className="label">
                  Libellé
                </label>
                <textarea id="ac-label" name="label" required maxLength={1000} rows={2} className="input" />
              </div>
            </div>
            <div>
              <SubmitButton pendingLabel="Ajout…">Ajouter l&apos;AC</SubmitButton>
            </div>
          </ActionForm>
        </section>
      )}
    </div>
  );
}
