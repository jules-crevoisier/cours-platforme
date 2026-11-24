import type { CourseProgress } from "@/lib/progress";

/** Barre de progression de lecture : « 3 pages lues sur 12 » + filet carré (jamais la couleur seule) */
export function ReadProgress({ progress, className }: { progress: CourseProgress; className?: string }) {
  if (progress.total === 0) return null;
  return (
    <div className={className}>
      <p className="text-sm text-muted">
        {progress.read} lue{progress.read > 1 ? "s" : ""} sur {progress.total}
      </p>
      <div
        role="progressbar"
        aria-label="Progression de lecture"
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.read}
        className="mt-1 h-1.5 w-full min-w-24 bg-sunken"
      >
        <div className="h-full bg-accent" style={{ width: `${progress.percent}%` }} />
      </div>
    </div>
  );
}
