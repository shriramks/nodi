"use client";

import { useRouter } from "next/navigation";

export function StatsTagFilter({
  tags,
  currentTag,
}: {
  tags: { id: string; name: string }[];
  currentTag: string | undefined;
}) {
  const router = useRouter();
  const isFiltered = !!currentTag;

  return (
    <div className="relative inline-flex items-center gap-1 h-[30px] rounded-lg px-2.5 cursor-pointer"
      style={{
        border: `1px solid ${isFiltered ? "var(--color-accent)" : "var(--color-divider)"}`,
        background: "transparent",
      }}
    >
      <span
        className="text-[13px] font-medium"
        style={{ color: isFiltered ? "var(--color-accent)" : "var(--color-text-2)" }}
      >
        {currentTag ?? "All movies"}
      </span>
      <svg
        width="9"
        height="5"
        viewBox="0 0 9 5"
        fill="none"
        style={{ opacity: 0.45, color: isFiltered ? "var(--color-accent)" : "currentColor" }}
      >
        <path d="M1 1L4.5 4.5L8 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <select
        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
        value={currentTag ?? ""}
        onChange={(e) => {
          const val = e.target.value;
          router.push(val ? `/stats?tag=${encodeURIComponent(val)}` : "/stats");
        }}
      >
        <option value="">All movies</option>
        {tags.map((tag) => (
          <option key={tag.id} value={tag.name}>
            {tag.name}
          </option>
        ))}
      </select>
    </div>
  );
}
