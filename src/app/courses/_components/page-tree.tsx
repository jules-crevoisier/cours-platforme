import Link from "next/link";
import type { PageNode } from "../_lib/tree";

type Props = {
  nodes: PageNode[];
  slug: string;
  currentId?: string;
  depth?: number;
  /** Préfixe des liens (défaut : /courses/<slug>/pages) — ex. /p/course/<jeton> pour le lien public */
  basePath?: string;
};

/** Sommaire imbriqué d'un cours */
export function PageTree({ nodes, slug, currentId, depth = 0, basePath }: Props) {
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
              className={`flex min-h-11 items-center px-2 break-words hover:bg-sunken ${
                current ? "bg-accent-soft font-semibold text-accent" : ""
              }`}
            >
              {node.title}
            </Link>
            {node.children.length > 0 && (
              <PageTree nodes={node.children} slug={slug} currentId={currentId} depth={depth + 1} basePath={basePath} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
