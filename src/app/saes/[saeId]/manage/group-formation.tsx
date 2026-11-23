import Link from "next/link";
import { addGroupMembersBulk, autoCreateGroups } from "../../actions";
import { ActionForm, SubmitButton } from "../../_components/action-form";

/** Ajout en lot dans un groupe : liste d'adresses collée */
export function BulkMembersForm({ groupId, groupName }: { groupId: string; groupName: string }) {
  const fieldId = `bulk-emails-${groupId}`;
  return (
    <ActionForm
      action={addGroupMembersBulk}
      resetOnSuccess
      className="flex flex-col gap-2"
      aria-label={`Ajouter une liste à ${groupName}`}
    >
      <input type="hidden" name="groupId" value={groupId} />
      <label htmlFor={fieldId} className="label">
        Ajouter une liste d&apos;adresses <span className="font-normal text-muted">(une par ligne)</span>
      </label>
      <textarea
        id={fieldId}
        name="emails"
        className="input py-2"
        rows={4}
        required
        maxLength={30000}
        autoComplete="off"
        spellCheck={false}
        placeholder={"lea.bernard@univ.fr\nhugo.moreau@univ.fr"}
      />
      <div>
        <SubmitButton pendingLabel="Ajout…">Ajouter ces étudiants</SubmitButton>
      </div>
    </ActionForm>
  );
}

type AutoProps = {
  saeId: string;
  cohort: { name: string } | null;
  /** Étudiants de la promo sans groupe dans cette SAÉ */
  unassigned: number;
};

/** Répartition au hasard des étudiants de la promo liée qui n'ont pas encore de groupe */
export function AutoGroupsForm({ saeId, cohort, unassigned }: AutoProps) {
  if (!cohort) {
    return (
      <p className="text-muted">
        Aucune promo liée.{" "}
        <Link href="?onglet=infos" className="link">
          Lier une promo
        </Link>
      </p>
    );
  }
  if (unassigned === 0) return <p className="text-muted">Tous les étudiants de {cohort.name} ont un groupe.</p>;

  return (
    <ActionForm
      action={autoCreateGroups}
      aria-label="Former les groupes automatiquement"
      confirmMessage={`Répartir au hasard ${unassigned} étudiant·es de ${cohort.name} dans de nouveaux groupes ?`}
    >
      <input type="hidden" name="saeId" value={saeId} />
      <label htmlFor="auto-group-size" className="label">
        Taille maximale d&apos;un groupe
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="auto-group-size"
          name="size"
          type="number"
          inputMode="numeric"
          min={2}
          max={12}
          defaultValue={4}
          required
          className="input sm:w-32"
        />
        <SubmitButton pendingLabel="Création des groupes…">Répartir la promo</SubmitButton>
      </div>
    </ActionForm>
  );
}
