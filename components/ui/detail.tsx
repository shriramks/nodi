import type { ReactNode } from "react";

function joinClasses(classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function DetailRow({
  divider = true,
  label,
  value,
}: {
  divider?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div
      className={joinClasses([
        "flex min-h-11 items-center justify-between gap-4 py-2.5",
        divider ? "border-b border-divider last:border-b-0" : undefined,
      ])}
    >
      <span className="text-[15px] text-text-2">{label}</span>
      <span className="tabnum text-[15px] font-semibold text-foreground">
        {value}
      </span>
    </div>
  );
}

export function DetailBlock({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  if (!value) {
    return null;
  }

  return (
    <div>
      <h2 className="text-[17px] font-bold leading-[1.25]">{label}</h2>
      <div className="mt-1 text-[17px] leading-[1.35] text-text-2">{value}</div>
    </div>
  );
}

export function DetailTextList({
  emptyText,
  items,
}: {
  emptyText: string;
  items: string[];
}) {
  if (items.length === 0) {
    return (
      <p className="text-[15px] leading-[1.4] text-text-muted">
        {emptyText}
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <p
          key={item}
          className="border-b border-divider pb-2.5 text-[15px] leading-[1.45] text-text-2 last:border-b-0 last:pb-0"
        >
          {item}
        </p>
      ))}
    </div>
  );
}
