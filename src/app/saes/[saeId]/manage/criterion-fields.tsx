"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { AcGroup } from "../../_lib/queries";
import { acOptionLabel } from "../../_lib/criteria";

/** Le référentiel n'est sérialisé qu'une fois pour tous les formulaires de critères de la page */
const AcOptionsContext = createContext<AcGroup[]>([]);

export function AcOptionsProvider({ groups, children }: { groups: AcGroup[]; children: ReactNode }) {
  return <AcOptionsContext.Provider value={groups}>{children}</AcOptionsContext.Provider>;
}

const LEVELS = [
  { value: "1", label: "Niveau 1 (BUT 1)" },
  { value: "2", label: "Niveau 2 (BUT 2)" },
  { value: "3", label: "Niveau 3 (BUT 3)" },
] as const;

type Defaults = { label: string; description: string | null; acCode: string | null; learningId: string | null };

type Props = {
  idPrefix: string;
  defaults?: Defaults;
  /** Niveau proposé par défaut (déduit du semestre de la SAÉ) */
  defaultLevel?: number | null;
};

/**
 * Champs d'un critère : choix d'un apprentissage critique du référentiel (filtré par niveau),
 * ou code AC libre en repli. Le code AC suit toujours l'AC choisi.
 */
export function CriterionFields({ idPrefix, defaults, defaultLevel }: Props) {
  const f = (name: string) => `${idPrefix}-${name}`;
  const groups = useContext(AcOptionsContext);
  const initial = defaults?.learningId
    ? groups.flatMap((g) => g.learnings).find((l) => l.id === defaults.learningId)
    : undefined;

  const initialLevel = initial ? String(initial.level) : defaultLevel ? String(defaultLevel) : "";
  const initialLearningId = initial?.id ?? "";
  const [level, setLevel] = useState(initialLevel);
  const [learningId, setLearningId] = useState(initialLearningId);

  // Après un ajout réussi, ActionForm réinitialise le formulaire : les sélecteurs contrôlés suivent
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) return;
    const onReset = () => {
      setLevel(initialLevel);
      setLearningId(initialLearningId);
    };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [initialLevel, initialLearningId]);

  const selected = learningId ? groups.flatMap((g) => g.learnings).find((l) => l.id === learningId) : undefined;
  const visible = groups
    .map((g) => ({
      ...g,
      learnings: g.learnings.filter((l) => !level || String(l.level) === level || l.id === learningId),
    }))
    .filter((g) => g.learnings.length > 0);

  return (
    <div ref={rootRef} className="grid gap-3 md:grid-cols-[11rem_minmax(0,1fr)]">
      <div>
        <label htmlFor={f("level")} className="label">
          Niveau
        </label>
        <select id={f("level")} className="input" value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="">Tous les niveaux</option>
          {LEVELS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-0">
        <label htmlFor={f("learningId")} className="label">
          Apprentissage critique
        </label>
        <select
          id={f("learningId")}
          name="learningId"
          className="input"
          value={learningId}
          onChange={(e) => setLearningId(e.target.value)}
        >
          <option value="">Aucun — code libre</option>
          {visible.map((g) => (
            <optgroup key={g.code} label={`${g.code} — ${g.name}`}>
              {g.learnings.map((l) => (
                <option key={l.id} value={l.id}>
                  {acOptionLabel(l.code, l.label)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {selected ? (
        <input type="hidden" name="acCode" value={selected.code} />
      ) : (
        <div>
          <label htmlFor={f("acCode")} className="label">
            Code AC libre <span className="font-normal text-muted">(optionnel)</span>
          </label>
          <input
            id={f("acCode")}
            name="acCode"
            className="input"
            maxLength={30}
            placeholder="AC11.01"
            autoComplete="off"
            defaultValue={defaults?.acCode ?? ""}
          />
        </div>
      )}

      <div className={selected ? "md:col-span-2" : "min-w-0"}>
        <label htmlFor={f("label")} className="label">
          Intitulé du critère{" "}
          {selected && <span className="font-normal text-muted">(vide = libellé de l&apos;AC)</span>}
        </label>
        <input
          id={f("label")}
          name="label"
          className="input"
          required={!selected}
          maxLength={190}
          placeholder={selected?.label ?? ""}
          defaultValue={defaults?.label ?? ""}
        />
      </div>
      <div className="md:col-span-2">
        <label htmlFor={f("description")} className="label">
          Description <span className="font-normal text-muted">(optionnel)</span>
        </label>
        <textarea
          id={f("description")}
          name="description"
          className="input py-2"
          rows={2}
          maxLength={3000}
          defaultValue={defaults?.description ?? ""}
        />
      </div>
    </div>
  );
}
