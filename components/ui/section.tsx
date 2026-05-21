import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

const sectionLabelClass = "text-[11px] uppercase tracking-wide text-text-muted";

function joinClasses(classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type SectionProps = {
  children: ReactNode;
  className?: string;
};

export function Section({ children, className }: SectionProps) {
  return <section className={joinClasses(["space-y-2", className])}>{children}</section>;
}

type SectionHeaderProps = {
  children: ReactNode;
  className?: string;
};

export function SectionHeader({ children, className }: SectionHeaderProps) {
  return (
    <p className={joinClasses(["flex min-h-8 items-center", sectionLabelClass, className])}>
      {children}
    </p>
  );
}

type CollapsibleSectionProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  title: ReactNode;
};

export function CollapsibleSection({
  children,
  className,
  contentClassName,
  title,
}: CollapsibleSectionProps) {
  return (
    <details className={joinClasses(["group space-y-2", className])}>
      <summary
        className={joinClasses([
          "flex min-h-8 cursor-pointer list-none items-center justify-between gap-3",
          sectionLabelClass,
          "active:opacity-70 [&::-webkit-details-marker]:hidden",
        ])}
      >
        <span>{title}</span>
        <ChevronDown
          aria-hidden="true"
          className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-180"
          strokeWidth={2.2}
        />
      </summary>
      <div className={contentClassName}>{children}</div>
    </details>
  );
}

type SectionScrollBleedProps = {
  children: ReactNode;
  className?: string;
};

export function SectionScrollBleed({ children, className }: SectionScrollBleedProps) {
  return (
    <div className={joinClasses(["-mx-4 overflow-x-auto px-4", className])}>
      {children}
    </div>
  );
}
