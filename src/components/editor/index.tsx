"use client";

import dynamic from "next/dynamic";

/** BlockNote manipule le DOM : chargement côté client uniquement */
export const BlockEditor = dynamic(() => import("./block-editor"), {
  ssr: false,
  loading: () => <div className="h-40 animate-pulse border border-line bg-surface" aria-busy="true" />,
});

export type { SaveContent, SaveResult } from "./block-editor";
