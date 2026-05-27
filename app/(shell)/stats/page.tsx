import type { ReactNode } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { getLibraryStats, listTags } from "@/lib/db/queries";
import type {
  LibraryStats,
  LibraryStatsBreakdownItem,
  LibraryStatsRatingBucket,
  MediaTypeFilter,
} from "@/lib/db/types";
import { SettingsSheet } from "@/components/settings/settings-sheet";
import { PageHeader, Section, SectionHeader } from "@/components/ui/section";
import { MoviesOverTime } from "./movies-over-time";
import { StatsFilters } from "./stats-tag-filter";

export const metadata: Metadata = {
  title: "Stats",
};

const LANGUAGE_COLORS = [
  "var(--chart-blue)",
  "var(--chart-green)",
  "var(--chart-orange)",
  "var(--chart-pink)",
  "var(--chart-purple)",
  "var(--chart-cyan)",
];

const GENRE_COLORS = [
  "var(--chart-blue)",
  "var(--chart-green)",
  "var(--chart-pink)",
  "var(--chart-purple)",
  "var(--chart-orange)",
  "var(--chart-cyan)",
];

type HeroMetricConfig = {
  value: ReactNode;
  label: string;
  valueClass: string;
  fontSize?: number;
};

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; year?: string; type?: string }>;
}) {
  const { tag: tagFilter, year, type } = await searchParams;
  const typeFilter = parseStatsType(type);
  const yearFilter = year && /^\d{4}$/.test(year) ? year : undefined;

  const [stats, tags] = await Promise.all([
    getLibraryStats(typeFilter, tagFilter, yearFilter),
    listTags(),
  ]);

  const hasData = stats.watchedCount > 0 || stats.watchEventCount > 0;

  const filteredLanguages = stats.languageBreakdown
    .filter((item) => item.key !== "unknown")
    .slice(0, 5);
  const statsHref = statsFilterHref({ type: typeFilter, tag: tagFilter, year: yearFilter });

  return (
    <main>
      <PageHeader
        title="Stats"
        className="pb-3"
        action={<SettingsSheet />}
      />

      <div className="pb-4">
        <StatsFilters
          tags={tags}
          years={stats.availableYearBuckets}
          currentType={typeFilter}
          currentTag={tagFilter}
          currentYear={yearFilter}
        />
      </div>

      {/* Hero metrics */}
      <StatsHero stats={stats} type={typeFilter} hasData={hasData} />

      <div className="h-px bg-divider" />

      {hasData ? (
        <>
          <MoviesOverTime
            monthBuckets={stats.monthBuckets}
            yearBuckets={stats.yearBuckets}
            typeFilter={typeFilter}
            tagFilter={tagFilter}
            yearFilter={yearFilter}
            returnTo={statsHref}
          />

          <div className="h-px bg-divider" />

          <StatsBreakdownSection title="By genre">
            {stats.genreBreakdown.length === 0 ? (
              <EmptyBreakdown />
            ) : (
              <GenreTreemap
                items={stats.genreBreakdown}
                colors={GENRE_COLORS}
                hrefForItem={(item) => libraryFilterHref({
                  type: typeFilter,
                  genre: item.label,
                  tag: tagFilter,
                  year: yearFilter,
                  returnTo: statsHref,
                })}
              />
            )}
          </StatsBreakdownSection>

          <div className="h-px bg-divider" />

          <StatsBreakdownSection title="By rating">
            <RatingDistribution
              breakdown={stats.ratingBreakdown}
              hrefForRating={(rating) => libraryFilterHref({
                type: typeFilter,
                rating,
                ratingOp: "=",
                tag: tagFilter,
                year: yearFilter,
                returnTo: statsHref,
              })}
            />
          </StatsBreakdownSection>

          <div className="h-px bg-divider" />

          <StatsBreakdownSection title="By language">
            {filteredLanguages.length === 0 ? (
              <EmptyBreakdown />
            ) : (
              <LanguageDonut
                items={filteredLanguages}
                hrefForItem={(item) => libraryFilterHref({
                  type: typeFilter,
                  language: item.key,
                  tag: tagFilter,
                  year: yearFilter,
                  returnTo: statsHref,
                })}
              />
            )}
          </StatsBreakdownSection>
        </>
      ) : (
        <p className="pt-6 text-[15px] leading-[1.4] text-text-2">
          No watch history yet. Mark something watched to see stats.
        </p>
      )}
    </main>
  );
}

function HeroMetric({
  value,
  label,
  valueClass,
  secondary = false,
  fontSize,
  border = false,
}: {
  value: ReactNode;
  label: string;
  valueClass: string;
  secondary?: boolean;
  fontSize?: number;
  border?: boolean;
}) {
  const size = secondary ? 15 : (fontSize ?? 22);
  return (
    <div
      className={[
        "min-w-0 flex flex-col gap-0.5 pr-3 last:pr-0",
        border ? "border-l border-divider pl-3" : "",
      ].join(" ")}
    >
      <p
        className={`tabnum leading-[1.1] truncate ${valueClass}`}
        style={{ fontSize: size, fontWeight: secondary ? 600 : 700 }}
      >
        {value}
      </p>
      <p className="text-[11px] text-text-muted truncate">{label}</p>
    </div>
  );
}

function StatsHero({
  hasData,
  stats,
  type,
}: {
  hasData: boolean;
  stats: LibraryStats;
  type: MediaTypeFilter;
}) {
  if (type === "all") {
    return <AllStatsHero stats={stats} hasData={hasData} />;
  }

  const metrics = heroMetrics(stats, type);

  return (
    <div
      className="grid pb-5"
      style={{ gridTemplateColumns: "1fr 1.5fr 1fr", rowGap: 20 }}
    >
      {metrics.primary.map((metric, index) => (
        <HeroMetric
          key={metric.label}
          value={metric.value}
          label={metric.label}
          valueClass={metric.valueClass}
          fontSize={metric.fontSize}
          border={index > 0}
        />
      ))}

      {hasData && metrics.secondary.map((metric, index) => (
        <HeroMetric
          key={metric.label}
          value={metric.value}
          label={metric.label}
          valueClass={metric.valueClass}
          secondary
          border={index > 0}
        />
      ))}
    </div>
  );
}

function ClapperboardIcon() {
  return (
    <svg width="14" height="13" viewBox="0 0 18 16" fill="none" aria-hidden>
      <rect x="1" y="5" width="16" height="10" rx="1.5" fill="currentColor" />
      <rect x="1" y="1.5" width="16" height="4" rx="1" fill="currentColor" />
      <line x1="4.5" y1="1.5" x2="3" y2="5.5" stroke="black" strokeWidth="1.2" strokeOpacity="0.45" />
      <line x1="8" y1="1.5" x2="6.5" y2="5.5" stroke="black" strokeWidth="1.2" strokeOpacity="0.45" />
      <line x1="11.5" y1="1.5" x2="10" y2="5.5" stroke="black" strokeWidth="1.2" strokeOpacity="0.45" />
      <line x1="15" y1="1.5" x2="13.5" y2="5.5" stroke="black" strokeWidth="1.2" strokeOpacity="0.45" />
    </svg>
  );
}

function TvIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 18 18" fill="none" aria-hidden>
      <line x1="6" y1="5.5" x2="3.5" y2="1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="12" y1="5.5" x2="14.5" y2="1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <rect x="1" y="5.5" width="16" height="10" rx="2" fill="currentColor" />
      <rect x="2.5" y="7" width="13" height="7" rx="1" fill="black" fillOpacity="0.25" />
      <rect x="4" y="15.5" width="3" height="1.5" rx="0.75" fill="currentColor" fillOpacity="0.75" />
      <rect x="11" y="15.5" width="3" height="1.5" rx="0.75" fill="currentColor" fillOpacity="0.75" />
    </svg>
  );
}

function AllStatsHero({ stats, hasData }: { stats: LibraryStats; hasData: boolean }) {
  const movieFlex = Math.max(stats.movieRuntimeMinutes, 1);
  const tvFlex = Math.max(stats.showRuntimeMinutes, 1);

  return (
    <div className="pb-5">
      {/* Total time */}
      <div className="pb-3">
        <p className="tabnum text-accent leading-[1.1]" style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.5px" }}>
          {formatRuntime(stats.runtimeMinutes)}
        </p>
        <p className="text-[11px] text-text-muted mt-0.5">Total time watched</p>
      </div>

      {/* Split bar */}
      {hasData && (
        <>
          <div className="flex overflow-hidden mb-1.5" style={{ height: 28, borderRadius: 8, gap: 2 }}>
            {/* Movie segment */}
            <div
              className="flex items-center gap-1.5 min-w-0"
              style={{
                flex: movieFlex,
                background: "rgba(210, 140, 60, 0.28)",
                borderRadius: "8px 0 0 8px",
                paddingLeft: 10,
              }}
            >
              <span className="shrink-0 opacity-50" style={{ color: "rgba(255,255,255,0.9)" }}>
                <ClapperboardIcon />
              </span>
              <span className="tabnum truncate" style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.55)" }}>
                {formatRuntime(stats.movieRuntimeMinutes)}
              </span>
            </div>
            {/* TV segment */}
            <div
              className="flex items-center gap-1.5 min-w-0"
              style={{
                flex: tvFlex,
                background: "rgba(60, 130, 200, 0.28)",
                borderRadius: "0 8px 8px 0",
                paddingLeft: 8,
              }}
            >
              <span className="shrink-0 opacity-50" style={{ color: "rgba(255,255,255,0.9)" }}>
                <TvIcon />
              </span>
              <span className="tabnum truncate" style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.55)" }}>
                {formatRuntime(stats.showRuntimeMinutes)}
              </span>
            </div>
          </div>

          <div className="flex justify-between mb-4">
            <p className="text-[11px] text-text-faint">Movie time</p>
            <p className="text-[11px] text-text-faint">TV time</p>
          </div>
        </>
      )}

      {/* Counts */}
      <div className="grid border-t border-divider pt-3.5" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
        {[
          { value: stats.movieCount.toString(), label: "Movies" },
          { value: stats.showCount.toString(), label: "Shows" },
          { value: stats.episodeWatchCount.toString(), label: "Episodes" },
        ].map(({ value, label }, index) => (
          <div
            key={label}
            className={index > 0 ? "border-l border-divider pl-3" : ""}
          >
            <p className="tabnum text-foreground leading-[1.1]" style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px" }}>
              {value}
            </p>
            <p className="text-[11px] text-text-muted mt-0.5">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function heroMetrics(stats: LibraryStats, type: MediaTypeFilter) {
  if (type === "movie") {
    return {
      primary: [
        plainMetric(stats.movieCount.toString(), "Movies", "text-foreground"),
        runtimeMetric(stats.runtimeMinutes, "Time watched", "text-accent"),
        ratingMetric(stats.avgRating),
      ],
      secondary: [
        plainMetric(favGenreValue(stats), "Fav genre", "text-text-2"),
        plainMetric(stats.avgRuntimeMinutes > 0 ? formatRuntime(stats.avgRuntimeMinutes) : "—", "Avg runtime", "text-text-2"),
        plainMetric(stats.favDecade ?? "—", "Fav decade", "text-text-2"),
      ],
    };
  }

  if (type === "show") {
    return {
      primary: [
        plainMetric(stats.showCount.toString(), "Shows", "text-foreground"),
        runtimeMetric(stats.showRuntimeMinutes, "TV time", "text-accent"),
        plainMetric(stats.episodeWatchCount.toString(), "Episodes", "text-foreground"),
      ],
      secondary: [
        plainMetric(favGenreValue(stats), "Fav genre", "text-text-2"),
        plainMetric(stats.avgRuntimeMinutes > 0 ? formatRuntime(stats.avgRuntimeMinutes) : "—", "Avg episode", "text-text-2"),
        ratingMetric(stats.avgRating, true),
      ],
    };
  }

  // "all" type is handled by AllStatsHero, this branch is unreachable
  return { primary: [], secondary: [] };
}

function plainMetric(
  value: ReactNode,
  label: string,
  valueClass: string,
): HeroMetricConfig {
  return { value, label, valueClass };
}

function runtimeMetric(minutes: number, label: string, valueClass: string): HeroMetricConfig {
  return {
    value: formatRuntime(minutes),
    label,
    valueClass,
    fontSize: minutes >= 86400 ? 20 : 22,
  };
}

function ratingMetric(avgRating: number | null, secondary = false): HeroMetricConfig {
  return {
    value: avgRating !== null ? (
      <>
        <span style={{ fontSize: secondary ? 12 : 14, lineHeight: 1 }}>♥</span>
        {` ${avgRating}`}
      </>
    ) : (
      "—"
    ),
    label: "Avg rating",
    valueClass: avgRating !== null ? "text-watched" : "text-text-faint",
  };
}

function favGenreValue(stats: LibraryStats) {
  return stats.favGenre !== null ? (
    <>
      {stats.favGenre}
      {stats.favGenreCount !== null && (
        <span className="tabnum ml-1.5 text-[12px] font-normal text-text-faint">
          {stats.favGenreCount}
        </span>
      )}
    </>
  ) : (
    "—"
  );
}

function StatsBreakdownSection({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <Section className="py-4">
      <SectionHeader>{title}</SectionHeader>
      {children}
    </Section>
  );
}

function EmptyBreakdown() {
  return <p className="text-[15px] leading-[1.4] text-text-muted">No data yet.</p>;
}

function GenreTreemap({
  items,
  colors,
  hrefForItem,
}: {
  items: LibraryStatsBreakdownItem[];
  colors: string[];
  hrefForItem: (item: LibraryStatsBreakdownItem) => string;
}) {
  const known = items.filter((i) => i.key !== "unknown").slice(0, 8);
  if (known.length === 0) return <EmptyBreakdown />;

  const total = known.reduce((s, i) => s + i.count, 0);
  if (total === 0) return <EmptyBreakdown />;

  const TOTAL_H = 130;
  const row1Items = known.slice(0, Math.min(2, known.length));
  const row2Items = known.slice(2);

  const row1Sum = row1Items.reduce((s, i) => s + i.count, 0);
  const row1H = row2Items.length === 0
    ? TOTAL_H
    : Math.round((row1Sum / total) * TOTAL_H);
  const row2H = TOTAL_H - row1H;

  return (
    <div className="flex flex-col" style={{ gap: 2 }}>
      <div className="flex" style={{ gap: 2, height: row1H }}>
        {row1Items.map((item, idx) => (
          <TreemapCell key={item.key} item={item} color={colors[idx % colors.length]} href={hrefForItem(item)} />
        ))}
      </div>
      {row2Items.length > 0 && (
        <div className="flex" style={{ gap: 2, height: row2H }}>
          {row2Items.map((item, idx) => (
            <TreemapCell key={item.key} item={item} color={colors[(idx + 2) % colors.length]} href={hrefForItem(item)} />
          ))}
        </div>
      )}
    </div>
  );
}

function TreemapCell({
  item,
  color,
  href,
}: {
  item: LibraryStatsBreakdownItem;
  color: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col justify-end overflow-hidden"
      style={{
        flex: item.count,
        background: color,
        borderRadius: 6,
        padding: "5px 7px",
        minWidth: 0,
      }}
      aria-label={`View ${item.label} library items`}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--chart-label-primary)",
          lineHeight: 1.2,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {item.label}
      </span>
      <span
        style={{
          fontSize: 10,
          color: "var(--chart-label-secondary)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {item.count}
      </span>
    </Link>
  );
}

function LanguageDonut({
  items,
  hrefForItem,
}: {
  items: LibraryStatsBreakdownItem[];
  hrefForItem: (item: LibraryStatsBreakdownItem) => string;
}) {
  const size = 140;
  const cx = 70;
  const cy = 70;
  const outerR = 64;
  const innerR = 44;
  const GAP = 0.03;

  const total = items.reduce((s, i) => s + i.count, 0);
  if (total === 0) return <EmptyBreakdown />;

  const segments = items.reduce<Array<{ item: LibraryStatsBreakdownItem; d: string; color: string; nextAngle: number }>>((acc, item, idx) => {
    const angle = acc[idx - 1]?.nextAngle ?? -Math.PI / 2;
    const sweep = (item.count / total) * 2 * Math.PI - GAP;
    const a1 = angle + GAP / 2;
    const a2 = a1 + sweep;
    const nextAngle = a2 + GAP / 2;
    const large = a2 - a1 > Math.PI ? 1 : 0;
    const cos1 = Math.cos(a1), sin1 = Math.sin(a1);
    const cos2 = Math.cos(a2), sin2 = Math.sin(a2);
    const x1o = cx + outerR * cos1, y1o = cy + outerR * sin1;
    const x2o = cx + outerR * cos2, y2o = cy + outerR * sin2;
    const x2i = cx + innerR * cos2, y2i = cy + innerR * sin2;
    const x1i = cx + innerR * cos1, y1i = cy + innerR * sin1;
    const d = `M${x1o.toFixed(2)} ${y1o.toFixed(2)} A${outerR} ${outerR} 0 ${large} 1 ${x2o.toFixed(2)} ${y2o.toFixed(2)} L${x2i.toFixed(2)} ${y2i.toFixed(2)} A${innerR} ${innerR} 0 ${large} 0 ${x1i.toFixed(2)} ${y1i.toFixed(2)} Z`;
    return [...acc, { item, d, color: LANGUAGE_COLORS[idx % LANGUAGE_COLORS.length], nextAngle }];
  }, []);

  const top = items[0];
  const topShort = top.label.slice(0, 3);

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {segments.map(({ item, d, color }) => (
          <a key={item.key} href={hrefForItem(item)} aria-label={`View ${item.label} library items`}>
            <path d={d} fill={color} />
          </a>
        ))}
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          fontSize={13}
          fontWeight={700}
          fill="var(--color-foreground)"
          fontFamily="-apple-system,sans-serif"
        >
          {topShort}
        </text>
        <text
          x={cx}
          y={cy + 10}
          textAnchor="middle"
          fontSize={11}
          fill="var(--color-text-faint)"
          fontFamily="-apple-system,sans-serif"
        >
          {top.count}
        </text>
      </svg>
      <div className="flex justify-center">
        {segments.map(({ item, color }, idx) => (
          <Link
            key={item.key}
            href={hrefForItem(item)}
            className={`flex items-center gap-1.5 px-2.5 ${idx > 0 ? "border-l border-divider" : ""}`}
          >
            <div className="shrink-0 rounded-full" style={{ width: 9, height: 9, background: color }} />
            <span className="text-[13px] text-text-2">{item.label.slice(0, 3)}</span>
            <span className="tabnum text-[13px] font-medium text-text-2">{item.count}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function RatingDistribution({
  breakdown,
  hrefForRating,
}: {
  breakdown: LibraryStatsRatingBucket[];
  hrefForRating: (rating: number) => string;
}) {
  const hasRatings = breakdown.some((b) => b.count > 0);
  const maxCount = Math.max(...breakdown.map((b) => b.count), 1);

  if (!hasRatings) {
    return <EmptyBreakdown />;
  }

  return (
    <div className="flex items-end gap-1.5" style={{ height: 80, paddingTop: 16 }}>
      {breakdown.map(({ rating, count }) => {
        const content = (
          <>
            <div
              className="w-full rounded-t-sm bg-accent transition-all"
              style={{
                height: count > 0 ? `${Math.max((count / maxCount) * 44, 3)}px` : "2px",
                opacity: count > 0 ? 1 : 0.12,
              }}
            />
            <span className="tabnum text-[10px] text-text-faint">{rating}</span>
          </>
        );

        return count > 0 ? (
          <Link
            key={rating}
            href={hrefForRating(rating)}
            className="flex flex-1 flex-col items-center gap-1"
            aria-label={`View ${rating} rated library items`}
          >
            {content}
          </Link>
        ) : (
          <div key={rating} className="flex flex-1 flex-col items-center gap-1">
            {content}
          </div>
        );
      })}
    </div>
  );
}

function libraryFilterHref({
  type,
  genre,
  language,
  tag,
  month,
  year,
  rating,
  ratingOp,
  returnTo,
}: {
  type: MediaTypeFilter;
  genre?: string;
  language?: string;
  tag?: string;
  month?: string;
  year?: string;
  rating?: number;
  ratingOp?: "=";
  returnTo: string;
}) {
  const params = new URLSearchParams();
  params.set("from", "stats");
  params.set("type", type);
  params.set("returnTo", returnTo);
  if (tag) params.set("tag", tag);
  if (genre) params.set("genre", genre);
  if (language) params.set("language", language);
  if (month) params.set("month", month);
  if (year) params.set("year", year);
  if (rating !== undefined) {
    params.set("ratingOp", ratingOp ?? "=");
    params.set("rating", String(rating));
  }
  return `/library?${params.toString()}`;
}

function statsFilterHref({
  type,
  tag,
  year,
}: {
  type: MediaTypeFilter;
  tag?: string;
  year?: string;
}) {
  const params = new URLSearchParams();
  if (type !== "all") params.set("type", type);
  if (tag) params.set("tag", tag);
  if (year) params.set("year", year);
  const query = params.toString();
  return query ? `/stats?${query}` : "/stats";
}

function parseStatsType(value: string | undefined): MediaTypeFilter {
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
