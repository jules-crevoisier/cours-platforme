import type { ReactNode } from "react";
import { AdminTabs } from "./admin-tabs";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AdminTabs />
      {children}
    </>
  );
}
