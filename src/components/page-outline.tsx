"use client";

import { useEffect, useState } from "react";
import { buildOutline, type OutlineItem } from "@/lib/outline";

const SELECTOR = '.bn-container [data-content-type="heading"]';

function readHeadings(): { text: string; level: number }[] {
  return [...document.querySelectorAll<HTMLElement>(SELECTOR)].map((el) => {
    const tag = el.querySelector("h1,h2,h3,h4,h5,h6")?.tagName;
    const level = Number(el.dataset.level ?? (tag ? tag[1] : 1));
    return { text: el.textContent ?? "", level };
  });
}

/** « Sur cette page » : titres du contenu, mis à jour pendant l'édition ; masqué s'il y a moins de 2 titres */
export function PageOutline() {
  const [items, setItems] = useState<OutlineItem[]>([]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setItems(buildOutline(readHeadings())), 250);
    };
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  if (items.length < 2) return null;

  function go(index: number) {
    document.querySelectorAll<HTMLElement>(SELECTOR)[index]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <nav aria-labelledby="sur-cette-page" className="text-sm">
      <h2 id="sur-cette-page" className="px-3 text-sm font-semibold text-muted">
        Sur cette page
      </h2>
      <ul className="mt-1 flex flex-col">
        {items.map((it) => (
          <li key={it.index}>
            <button
              type="button"
              onClick={() => go(it.index)}
              className="flex min-h-9 w-full cursor-pointer items-center border-l-2 border-line py-1.5 pr-2 text-left text-sm text-muted transition-colors break-words hover:border-ink hover:text-ink"
              style={{ paddingLeft: `${0.75 + it.level * 0.75}rem` }}
            >
              {it.text}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
