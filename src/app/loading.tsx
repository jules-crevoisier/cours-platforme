/** Squelette statique (aucune animation) : titre puis quelques blocs ; « Chargement… » annoncé aux lecteurs d'écran */
export default function Loading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-10">
      <span role="status" className="sr-only">
        Chargement…
      </span>
      <div aria-hidden="true" className="flex flex-col gap-3">
        <div className="skeleton h-4 w-32" />
        <div className="skeleton h-9 w-2/3 max-w-md" />
      </div>
      <div aria-hidden="true" className="flex flex-col gap-4">
        <div className="skeleton h-24 w-full" />
        <div className="skeleton h-14 w-full" />
        <div className="skeleton h-14 w-full" />
        <div className="skeleton h-14 w-4/5" />
      </div>
    </div>
  );
}
