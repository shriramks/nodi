import type { ReactNode } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { getCompanionTagName, getInsightsPageData } from "@/lib/db/queries";
import type { Insights, InsightsPeriodTotals, LibraryStats, MediaTypeFilter } from "@/lib/db/types";
import { SettingsSheet } from "@/components/settings/settings-sheet";
import { PageHeader, Section, SectionHeader } from "@/components/ui/section";

export const metadata: Metadata = {
  title: "Insights",
};

const typeOptions: Array<{ value: MediaTypeFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "movie", label: "Movies" },
  { value: "show", label: "Shows" },
];

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const typeFilter = parseInsightsType(type);
  const { stats, insights } = await getInsightsPageData(typeFilter);
  const companion = companionLabel(getCompanionTagName());
  const hasData = stats.watchedCount > 0 || stats.watchEventCount > 0;

  return (
    <main>
      <PageHeader title="Insights" className="pb-3" action={<SettingsSheet />} />

      <div className="pb-4">
        <TypeFilter current={typeFilter} />
      </div>

      {hasData ? (
        <>
          <Section className="pb-5">
            <SectionHeader>All-time</SectionHeader>
            <AllTimeCards stats={stats} type={typeFilter} />
          </Section>

          {insights.hasCompanionData ? (
            <>
              <div className="h-px bg-divider" />
              <Section className="py-4">
                <SectionHeader>Habits with {companion}</SectionHeader>
                <HabitRows habits={insights.habits} />
              </Section>

              <div className="h-px bg-divider" />
              <Section className="py-4">
                <SectionHeader>This year with {companion}</SectionHeader>
                <ThisYearRows thisYear={insights.thisYear} companion={companion} />
              </Section>
            </>
          ) : (
            <p className="pt-4 text-[15px] leading-[1.4] text-text-muted">
              Nothing watched with {companion} yet.
            </p>
          )}
        </>
      ) : (
        <p className="pt-6 text-[15px] leading-[1.4] text-text-2">
          No watch history yet. Mark something watched to see insights.
        </p>
      )}
    </main>
  );
}

function TypeFilter({ current }: { current: MediaTypeFilter }) {
  return (
    <div className="flex items-center gap-2">
      {typeOptions.map((option) => {
        const active = option.value === current;
        return (
          <Link
            key={option.value}
            href={option.value === "all" ? "/insights" : `/insights?type=${option.value}`}
            className="inline-flex h-9 items-center rounded-full px-3 text-[13px] font-medium"
            style={{
              border: `1px solid ${active ? "var(--color-accent)" : "var(--color-divider)"}`,
              color: active ? "var(--color-accent)" : "var(--color-text-2)",
            }}
            aria-current={active ? "page" : undefined}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}

function AllTimeCards({ stats, type }: { stats: LibraryStats; type: MediaTypeFilter }) {
  const showMovies = type !== "show";
  const showShows = type !== "movie";

  return (
    <div className={`grid gap-2.5 ${showMovies && showShows ? "grid-cols-2" : "grid-cols-1"}`}>
      {showMovies && (
        <TotalsCard
          kind="Movies"
          count={stats.movieCount}
          unit={stats.movieCount === 1 ? "movie" : "movies"}
          runtimeMinutes={stats.movieRuntimeMinutes}
        />
      )}
      {showShows && (
        <TotalsCard
          kind="Shows"
          count={stats.showCount}
          unit={stats.showCount === 1 ? "show" : "shows"}
          runtimeMinutes={stats.showRuntimeMinutes}
        />
      )}
    </div>
  );
}

function TotalsCard({
  count,
  kind,
  runtimeMinutes,
  unit,
}: {
  count: number;
  kind: string;
  runtimeMinutes: number;
  unit: string;
}) {
  return (
    <div className="rounded-[14px] bg-surface p-3.5">
      <p className="mb-2 text-[12px] text-text-2">{kind}</p>
      <p className="tabnum text-[28px] font-bold leading-[1.1] tracking-[-0.5px]">
        {count}
        <span className="ml-1 text-[13px] font-medium text-text-2">{unit}</span>
      </p>
      <p className="tabnum mt-1.5 text-[15px] font-semibold text-accent">
        {formatRuntime(runtimeMinutes)}
        <span className="ml-1 text-[12px] font-medium text-text-muted">watched</span>
      </p>
    </div>
  );
}

function HabitRows({ habits }: { habits: Insights["habits"] }) {
  return (
    <div>
      {habits.busiestMonth && (
        <InsightRow
          accent
          value={habits.busiestMonth.label}
          description={`busiest month, ${titleCountLabel(habits.busiestMonth.titleCount)}`}
        />
      )}
      {habits.quietestMonth && (
        <InsightRow
          accent
          value={habits.quietestMonth.label}
          description={`quietest month, ${titleCountLabel(habits.quietestMonth.titleCount)}`}
        />
      )}
      {habits.topWeekday && <InsightRow value={habits.topWeekday} description="day you watch most" />}
      {habits.topDecade && <InsightRow value={habits.topDecade} description="decade you watch most" />}
    </div>
  );
}

function ThisYearRows({
  companion,
  thisYear,
}: {
  companion: string;
  thisYear: Insights["thisYear"];
}) {
  const { withCompanion, withCompanionLastYear, withoutCompanion } = thisYear;
  const hasComparison = withCompanion.titleCount > 0 || withCompanionLastYear.titleCount > 0;

  return (
    <div>
      <InsightRow
        accent
        value={`${formatRuntime(withCompanion.runtimeMinutes)} · ${formatPercent(thisYear.companionSharePercent)}`}
        description="time, and share of all watching"
      />
      {hasComparison && (
        <InsightRow
          accent
          value={`${signed(withCompanion.titleCount - withCompanionLastYear.titleCount)} · ${signedRuntime(
            withCompanion.runtimeMinutes - withCompanionLastYear.runtimeMinutes,
          )}`}
          description="titles and time vs last year"
        />
      )}
      {thisYear.highestRated && <InsightRow value={thisYear.highestRated.title} description="highest-rated" />}
      {thisYear.lowestRated && <InsightRow value={thisYear.lowestRated.title} description="lowest-rated" />}
      {thisYear.avgRating !== null && (
        <InsightRow
          value={thisYear.avgRating.toFixed(1)}
          description={
            thisYear.avgRatingLastYear !== null
              ? `average rating, vs ${thisYear.avgRatingLastYear.toFixed(1)} last year`
              : "average rating"
          }
        />
      )}
      <InsightRow value={totalsValue(withoutCompanion)} description={`titles and time without ${companion}`} />
    </div>
  );
}

function InsightRow({
  accent = false,
  description,
  value,
}: {
  accent?: boolean;
  description: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-3.5 border-b border-divider py-3 last:border-b-0">
      <p
        className={`tabnum w-[42%] shrink-0 break-words text-[17px] font-bold leading-[1.2] ${
          accent ? "text-accent" : "text-foreground"
        }`}
      >
        {value}
      </p>
      <p className="min-w-0 text-[14px] leading-[1.35] text-text-2">{description}</p>
    </div>
  );
}

function totalsValue(totals: InsightsPeriodTotals) {
  return `${totals.titleCount} · ${formatRuntime(totals.runtimeMinutes)}`;
}

function titleCountLabel(count: number) {
  return `${count} ${count === 1 ? "title" : "titles"}`;
}

function formatPercent(value: number | null) {
  return value === null ? "0%" : `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
}

function signed(value: number) {
  if (value === 0) return "0";
  return value > 0 ? `+${value}` : `-${Math.abs(value)}`;
}

function signedRuntime(minutes: number) {
  if (minutes === 0) return "0m";
  return `${minutes > 0 ? "+" : "-"}${formatRuntime(Math.abs(minutes))}`;
}

function companionLabel(tagName: string) {
  return tagName.charAt(0).toUpperCase() + tagName.slice(1);
}

function parseInsightsType(value: string | undefined): MediaTypeFilter {
  return value === "movie" || value === "show" ? value : "all";
}

function formatRuntime(minutes: number) {
  if (minutes <= 0) return "0m";
  const days = Math.floor(minutes / 1440);
  const dayHours = Math.floor((minutes % 1440) / 60);
  const remainingMinutes = Math.floor(minutes % 60);
  const hours = Math.floor(minutes / 60);

  if (days > 0) {
    if (dayHours > 0 && remainingMinutes > 0) return `${days}d ${dayHours}h ${remainingMinutes}m`;
    if (dayHours > 0) return `${days}d ${dayHours}h`;
    if (remainingMinutes > 0) return `${days}d ${remainingMinutes}m`;
    return `${days}d`;
  }
  if (hours > 0) return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  return `${remainingMinutes}m`;
}
