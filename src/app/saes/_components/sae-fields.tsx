import { toInputDate } from "../_lib/dates";

export type CourseOption = { id: string; title: string };
export type CohortOption = { id: string; name: string; academicYear: string };

export type SaeFieldDefaults = {
  code: string | null;
  title: string;
  semester: number | null;
  competences: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  courseId: string | null;
  cohortId?: string | null;
};

type Props = {
  /** Préfixe des id HTML (plusieurs formulaires sur une page) */
  idPrefix: string;
  courses: CourseOption[];
  /** Promos proposées (sélecteur masqué si absent) */
  cohorts?: CohortOption[];
  defaults?: Partial<SaeFieldDefaults>;
};

const SEMESTERS = [1, 2, 3, 4, 5, 6] as const;

/** Champs communs à la création et à l'onglet « Infos » de la gestion d'une SAÉ */
export function SaeFields({ idPrefix, courses, cohorts, defaults }: Props) {
  const f = (name: string) => `${idPrefix}-${name}`;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <label htmlFor={f("code")} className="label">
          Code <span className="font-normal text-muted">(optionnel)</span>
        </label>
        <input
          id={f("code")}
          name="code"
          className="input"
          maxLength={40}
          placeholder="SAÉ 2.01"
          defaultValue={defaults?.code ?? ""}
        />
      </div>
      <div>
        <label htmlFor={f("semester")} className="label">
          Semestre
        </label>
        <select id={f("semester")} name="semester" className="input" defaultValue={defaults?.semester ?? ""}>
          <option value="">Non précisé</option>
          {SEMESTERS.map((s) => (
            <option key={s} value={s}>
              Semestre {s}
            </option>
          ))}
        </select>
      </div>
      <div className="md:col-span-2">
        <label htmlFor={f("title")} className="label">
          Titre
        </label>
        <input
          id={f("title")}
          name="title"
          className="input"
          required
          maxLength={190}
          defaultValue={defaults?.title ?? ""}
        />
      </div>
      <div className="md:col-span-2">
        <label htmlFor={f("competences")} className="label">
          Compétences visées <span className="font-normal text-muted">(optionnel)</span>
        </label>
        <textarea
          id={f("competences")}
          name="competences"
          className="input py-2"
          rows={2}
          maxLength={2000}
          placeholder="C1 Comprendre, C4 Développer"
          defaultValue={defaults?.competences ?? ""}
        />
      </div>
      <div>
        <label htmlFor={f("startsAt")} className="label">
          Début
        </label>
        <input
          id={f("startsAt")}
          name="startsAt"
          type="date"
          className="input"
          defaultValue={toInputDate(defaults?.startsAt)}
        />
      </div>
      <div>
        <label htmlFor={f("endsAt")} className="label">
          Fin
        </label>
        <input id={f("endsAt")} name="endsAt" type="date" className="input" defaultValue={toInputDate(defaults?.endsAt)} />
      </div>
      <div className={cohorts ? "" : "md:col-span-2"}>
        <label htmlFor={f("courseId")} className="label">
          Cours lié <span className="font-normal text-muted">(optionnel)</span>
        </label>
        <select id={f("courseId")} name="courseId" className="input" defaultValue={defaults?.courseId ?? ""}>
          <option value="">Aucun cours</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>
      {cohorts && (
        <div>
          <label htmlFor={f("cohortId")} className="label">
            Promo <span className="font-normal text-muted">(optionnel)</span>
          </label>
          <select id={f("cohortId")} name="cohortId" className="input" defaultValue={defaults?.cohortId ?? ""}>
            <option value="">Aucune promo</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.academicYear})
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
