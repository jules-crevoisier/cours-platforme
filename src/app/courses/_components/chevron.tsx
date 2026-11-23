import { Icon } from "@/components/ui";

/** Indicateur d'ouverture pour <summary> (le marqueur natif disparaît avec display:flex) — parent <details className="group"> */
export function Chevron() {
  return <Icon name="chevronRight" size={16} className="shrink-0 transition-transform duration-200 group-open:rotate-90" />;
}
