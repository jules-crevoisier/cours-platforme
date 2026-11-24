import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import type { PageNode } from "../_lib/tree";

type Props = {
  nodes: PageNode[];
  slug: string;
  currentId?: string;
  depth?: number;
  /** Préfixe des liens (défaut : /courses/<slug>/pages) — ex. /p/course/<jeton> pour le lien public */
  basePath?: string;
  /** Pages lues par l'utilisateur : une coche s'affiche à droite du titre */
  readIds?: ReadonlySet<string>;
};

/** Sommaire imbriqué d'un cours */
export function PageTree({ nodes, slug, currentId, depth = 0, basePath, readIds }: Props) {
  const base = basePath ?? `/courses/${slug}/pages`;
  return (
    <ol className={depth === 0 ? "flex flex-col" : "ml-4 flex flex-col border-l border-line pl-2"}>
      {nodes.map((node) => {
        const current = node.id === currentId;
        return (
          <li key={node.id}>
            <Link
              href={`${base}/${node.id}`}
              aria-current={current ? "page" : undefined}
              className={`flex min-h-11 items-center justify-between gap-2 px-2 break-words hover:bg-sunken ${
                current ? "bg-accent-soft font-semibold text-accent" : ""
              }`}
            >
              <span className="min-w-0">{node.title}</span>
              {readIds?.has(node.id) && (
                <span className="shrink-0 text-ok">
                  <Icon name="check" size={16} />
                  <span className="sr-only"> (lue)</span>
                </span>
              )}
            </Link>
            {node.children.length > 0 && (
              <PageTree nodes={node.children} slug={slug} currentId={currentId} depth={depth + 1} basePath={basePath} readIds={readIds} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
