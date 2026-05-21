import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

const sectionLabelBaseClass = "text-[11px] uppercase tracking-wide";
const sectionLabelClass = `${sectionLabelBaseClass} text-text-muted`;

function joinClasses(classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type SectionProps = {
  children: ReactNode;
  className?: string;
};

type PageHeaderProps = {
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  leading?: ReactNode;
  subtitle?: ReactNode;
  title: ReactNode;
};

export function PageHeader({
  action,
  children,
  className,
  leading,
  subtitle,
  title,
}: PageHeaderProps) {
  return (
    <section className={joinClasses(["space-y-2", className])}>
      {leading}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[32px] font-bold leading-[1.1]">{title}</h1>
          {subtitle ? (
            <p className="mt-1 text-[13px] leading-[1.4] text-text-2">{subtitle}</p>
          ) : null}
          {children}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </section>
  );
}

export function Section({ children, className }: SectionProps) {
  return <section className={joinClasses(["space-y-2", className])}>{children}</section>;
}

type SectionHeaderProps = {
  children: ReactNode;
  className?: string;
};

export function SectionHeader({ children, className }: SectionHeaderProps) {
  return (
    <div className={joinClasses(["flex min-h-8 items-center", sectionLabelClass, className])}>
      {children}
    </div>
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

type SheetSectionProps = {
  children: ReactNode;
  className?: string;
};

export function SheetSection({ children, className }: SheetSectionProps) {
  return <section className={joinClasses(["px-5 py-3", className])}>{children}</section>;
}

type SheetSectionHeaderProps = {
  children: ReactNode;
  className?: string;
};

export function SheetSectionHeader({ children, className }: SheetSectionHeaderProps) {
  return (
    <p className={joinClasses([sectionLabelBaseClass, "pb-2 font-semibold text-text-faint", className])}>
      {children}
    </p>
  );
}

type SheetSectionDividerProps = {
  className?: string;
};

export function SheetSectionDivider({ className }: SheetSectionDividerProps) {
  return <div className={joinClasses(["mx-5 h-px bg-divider", className])} />;
}

type SheetScrollBleedProps = {
  children: ReactNode;
  className?: string;
};

export function SheetScrollBleed({ children, className }: SheetScrollBleedProps) {
  return (
    <div className={joinClasses(["-mx-5 overflow-x-auto px-5", className])}>
      {children}
    </div>
  );
}
