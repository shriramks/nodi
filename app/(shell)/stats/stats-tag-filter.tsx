"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { LibraryStatsTimeBucket, MediaTypeFilter } from "@/lib/db/types";

const typeOptions: Array<{ value: MediaTypeFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "movie", label: "Movies" },
  { value: "show", label: "Shows" },
];

export function StatsFilters({
  tags,
  years,
  currentType,
  currentTag,
  currentYear,
}: {
  tags: { id: string; name: string }[];
  years: LibraryStatsTimeBucket[];
  currentType: MediaTypeFilter;
  currentTag: string | undefined;
  currentYear: string | undefined;
}) {
  const router = useRouter();
  const yearOptions = [...years].reverse();
  const hasCurrentYearOption = currentYear
    ? yearOptions.some((year) => year.key === currentYear)
    : true;

  function pushFilter(next: { type?: MediaTypeFilter; tag?: string; year?: string }) {
    const params = new URLSearchParams();
    const type = Object.hasOwn(next, "type") ? next.type : currentType;
    const tag = Object.hasOwn(next, "tag") ? next.tag : currentTag;
    const year = Object.hasOwn(next, "year") ? next.year : currentYear;

    if (type && type !== "all") params.set("type", type);
    if (tag) params.set("tag", tag);
    if (year) params.set("year", year);

    const query = params.toString();
    router.push(query ? `/stats?${query}` : "/stats");
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <StatsSelect
        label={typeOptions.find((option) => option.value === currentType)?.label ?? "All"}
        value={currentType}
        active={currentType !== "all"}
        onChange={(value) => pushFilter({ type: value as MediaTypeFilter })}
      >
        {typeOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </StatsSelect>

      {tags.length > 0 && (
        <StatsSelect
          label={currentTag ?? "All tags"}
          value={currentTag ?? ""}
          active={!!currentTag}
          onChange={(value) => pushFilter({ tag: value || undefined })}
        >
          <option value="">All tags</option>
          {tags.map((tag) => (
            <option key={tag.id} value={tag.name}>
              {tag.name}
            </option>
          ))}
        </StatsSelect>
      )}

      <StatsSelect
        label={currentYear ?? "All time"}
        value={currentYear ?? ""}
        active={!!currentYear}
        onChange={(value) => pushFilter({ year: value || undefined })}
      >
        <option value="">All time</option>
        {!hasCurrentYearOption && <option value={currentYear ?? ""}>{currentYear}</option>}
        {yearOptions.map((year) => (
          <option key={year.key} value={year.key}>
            {year.label}
          </option>
        ))}
      </StatsSelect>
    </div>
  );
}

function StatsSelect({
  active,
  children,
  label,
  onChange,
  value,
}: {
  active: boolean;
  children: ReactNode;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div
      className="relative inline-flex h-9 max-w-[150px] shrink-0 cursor-pointer items-center gap-1 rounded-full px-3"
      style={{
        border: `1px solid ${active ? "var(--color-accent)" : "var(--color-divider)"}`,
        background: "transparent",
      }}
    >
      <span
        className="truncate text-[13px] font-medium"
        style={{ color: active ? "var(--color-accent)" : "var(--color-text-2)" }}
      >
        {label}
      </span>
      <svg
        aria-hidden="true"
        className="shrink-0"
        width="9"
        height="5"
        viewBox="0 0 9 5"
        fill="none"
        style={{ opacity: 0.45, color: active ? "var(--color-accent)" : "currentColor" }}
      >
        <path
          d="M1 1L4.5 4.5L8 1"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <select
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
      >
        {children}
      </select>
    </div>
  );
}
