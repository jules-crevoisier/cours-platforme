import { duplicateSae } from "../../actions";
import { ActionForm, SubmitButton } from "../../_components/action-form";

/** Reconduction d'une année sur l'autre : copie en brouillon avec dates décalées */
export function DuplicateSection({ saeId }: { saeId: string }) {
  return (
    <section aria-labelledby="dupliquer" className="flex flex-col gap-4">
      <h2 id="dupliquer" className="text-xl">
        Dupliquer
      </h2>
      <ActionForm action={duplicateSae} aria-label="Dupliquer la SAÉ">
        <input type="hidden" name="saeId" value={saeId} />
        <label htmlFor="duplicate-weeks" className="label">
          Décaler les dates de (semaines)
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="duplicate-weeks"
            name="weeks"
            type="number"
            inputMode="numeric"
            min={-260}
            max={260}
            defaultValue={52}
            required
            className="input sm:w-32"
          />
          <SubmitButton pendingLabel="Duplication…">Dupliquer la SAÉ</SubmitButton>
        </div>
      </ActionForm>
    </section>
  );
}
