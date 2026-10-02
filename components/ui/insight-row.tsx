import type { ReactNode } from "react";

// Value column sizes to the widest value and never wraps; the description takes the rest.
export function InsightRows({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-[minmax(0,max-content)_minmax(0,1fr)] gap-x-3.5">{children}</div>;
}

export function InsightRow({
  description,
  value,
}: {
  description: string;
  value: ReactNode;
}) {
  return (
    <div className="col-span-2 grid grid-cols-subgrid items-baseline border-b border-divider py-3 last:border-b-0">
      <p
        className="tabnum max-w-[10rem] truncate whitespace-nowrap text-[17px] font-bold leading-[1.2] text-foreground"
      >
        {value}
      </p>
      <p className="min-w-0 text-[14px] leading-[1.35] text-text-2">{description}</p>
    </div>
  );
}
