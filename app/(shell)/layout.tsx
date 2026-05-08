import type { ReactNode } from "react";
import { BottomPillNav } from "@/components/navigation/bottom-pill-nav";

type ShellLayoutProps = {
  children: ReactNode;
};

export default function ShellLayout({ children }: ShellLayoutProps) {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pt-6" style={{ paddingBottom: "calc(var(--nav-h) + 48px)" }}>
        {children}
      </div>
      <BottomPillNav />
    </div>
  );
}
