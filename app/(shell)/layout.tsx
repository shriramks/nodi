import type { ReactNode } from "react";
import { BottomPillNav } from "@/components/navigation/bottom-pill-nav";

type ShellLayoutProps = {
  children: ReactNode;
};

export default function ShellLayout({ children }: ShellLayoutProps) {
  return (
    <div className="relative min-h-dvh">
      <div
        className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4"
        style={{
          paddingTop: "calc(1.5rem + env(safe-area-inset-top))",
          paddingBottom: "calc(var(--nav-h) + 1.5rem + env(safe-area-inset-bottom))",
        }}
      >
        {children}
      </div>
      <BottomPillNav />
    </div>
  );
}
