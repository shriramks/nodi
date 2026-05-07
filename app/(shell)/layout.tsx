import type { ReactNode } from "react";
import { BottomPillNav } from "@/components/navigation/bottom-pill-nav";

type ShellLayoutProps = {
  children: ReactNode;
};

export default function ShellLayout({ children }: ShellLayoutProps) {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top,_rgba(11,132,255,0.15),_transparent_58%)]" />
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-28 pt-6 sm:px-5">
        {children}
      </div>
      <BottomPillNav />
    </div>
  );
}
