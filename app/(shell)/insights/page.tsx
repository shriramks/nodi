import type { Metadata } from "next";
import { getCompanionTagName, getInsightsPageData } from "@/lib/db/queries";
import type { Insights, InsightsPeriodTotals, LibraryStats } from "@/lib/db/types";
import { SettingsSheet } from "@/components/settings/settings-sheet";
import { InsightRow, InsightRows } from "@/components/ui/insight-row";
import { PageHeader, Section, SectionHeader } from "@/components/ui/section";
import {
  companionLabel,
  formatPercent,
  formatRuntime,
  signed,
  signedRuntime,
} from "@/lib/media/format";

export const metadata: Metadata = {
  title: "Insights",
};

export default async function InsightsPage() {
  const { stats, insights } = await getInsightsPageData();
  const companion = companionLabel(getCompanionTagName());
  const hasData = stats.watchedCount > 0 || stats.watchEventCount > 0;

  return (
    <main>
      <PageHeader title="Insights" className="pb-4" action={<SettingsSheet />} />

      {hasData ? (
        <>
          <Section className="pb-5">
            <SectionHeader>All-time</SectionHeader>
            <AllTimeCards stats={stats} />
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

function AllTimeCards({ stats }: { stats: LibraryStats }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <TotalsCard
        kind="Movies"
        count={stats.movieCount}
        unit={stats.movieCount === 1 ? "movie" : "movies"}
        runtimeMinutes={stats.movieRuntimeMinutes}
      />
      <TotalsCard
        kind="Shows"
        count={stats.showCount}
        unit={stats.showCount === 1 ? "show" : "shows"}
        runtimeMinutes={stats.showRuntimeMinutes}
      />
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
    <InsightRows>
      {habits.busiestMonth && (
        <InsightRow
            value={habits.busiestMonth.label}
          description={`busiest month, ${titleCountLabel(habits.busiestMonth.titleCount)}`}
        />
      )}
      {habits.quietestMonth && (
        <InsightRow
            value={habits.quietestMonth.label}
          description={`quietest month, ${titleCountLabel(habits.quietestMonth.titleCount)}`}
        />
      )}
      {habits.topWeekday && <InsightRow value={habits.topWeekday} description="day you watch most" />}
      {habits.topDecade && <InsightRow value={habits.topDecade} description="decade you watch most" />}
    </InsightRows>
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
    <InsightRows>
      <InsightRow
        value={`${formatRuntime(withCompanion.runtimeMinutes)} · ${formatPercent(thisYear.companionSharePercent)}`}
        description="time, and share of all watching"
      />
      {hasComparison && (
        <InsightRow
            value={`${signed(withCompanion.titleCount - withCompanionLastYear.titleCount)} · ${signedRuntime(
            withCompanion.runtimeMinutes - withCompanionLastYear.runtimeMinutes,
          )}`}
          description="titles and time vs last year"
        />
      )}
      {thisYear.highestRated && <InsightRow value={thisYear.highestRated.title} description={`highest-rated, ${thisYear.highestRated.rating.toFixed(1)}`} />}
      {thisYear.lowestRated && <InsightRow value={thisYear.lowestRated.title} description={`lowest-rated, ${thisYear.lowestRated.rating.toFixed(1)}`} />}
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
    </InsightRows>
  );
}

function totalsValue(totals: InsightsPeriodTotals) {
  return `${totals.titleCount} · ${formatRuntime(totals.runtimeMinutes)}`;
}

function titleCountLabel(count: number) {
  return `${count} ${count === 1 ? "title" : "titles"}`;
}
