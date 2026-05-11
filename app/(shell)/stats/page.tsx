import type { ReactNode } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { getLibraryStats, listTags } from "@/lib/db/queries";
import type { LibraryStatsBreakdownItem, LibraryStatsRatingBucket } from "@/lib/db/types";
import { SettingsSheet } from "@/components/settings/settings-sheet";
import { MoviesOverTime } from "./movies-over-time";
import { StatsTagFilter } from "./stats-tag-filter";

export const metadata: Metadata = {
  title: "Stats",
};

const LANGUAGE_COLORS = [
  "#0A84FF",
  "#34C759",
  "#FF9F0A",
  "#FF375F",
  "#BF5AF2",
  "#64D2FF",
];

const GENRE_COLORS = [
  "#0A84FF",
  "#34C759",
  "#FF375F",
  "#BF5AF2",
  "#FF9F0A",
  "#64D2FF",
];

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>;
}) {
  const { tag: tagFilter } = await searchParams;

  const [stats, tags] = await Promise.all([
    getLibraryStats(tagFilter),
    listTags(),
  ]);

  const hasData = stats.watchEventCount > 0;

  const filteredLanguages = stats.languageBreakdown
    .filter((item) => item.key !== "unknown")
    .slice(0, 5);
  const statsHref = tagFilter ? `/stats?tag=${encodeURIComponent(tagFilter)}` : "/stats";

  return (
    <main>
      {/* Header */}
      <section className="flex items-center justify-between gap-4 pb-3">
        <h1 className="text-[32px] font-bold leading-[1.1]">Stats</h1>
        <div className="flex items-center gap-2 shrink-0">
          {tags.length > 0 && <StatsTagFilter tags={tags} currentTag={tagFilter} />}
          <SettingsSheet />
        </div>
      </section>

      {/* Hero metrics */}
      <div
        className="grid pb-5"
        style={{ gridTemplateColumns: "1fr 1.5fr 1fr", rowGap: 20 }}
      >
        <HeroMetric
          value={stats.watchedCount.toString()}
          label="Movies"
          valueClass="text-foreground"
        />
        <HeroMetric
          value={formatRuntime(stats.runtimeMinutes)}
          label="Time watched"
          valueClass="text-accent"
          fontSize={stats.runtimeMinutes >= 86400 ? 20 : 22}
          border
        />
        <HeroMetric
          value={
            stats.avgRating !== null ? (
              <>
                <span style={{ fontSize: 14, lineHeight: 1 }}>♥</span>
                {` ${stats.avgRating}`}
              </>
            ) : (
              "—"
            )
          }
          label="Avg rating"
          valueClass={stats.avgRating !== null ? "text-watched" : "text-text-faint"}
          border
        />

        {hasData && (
          <>
            <HeroMetric
              value={
                stats.favGenre !== null ? (
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
                )
              }
              label="Fav genre"
              valueClass="text-text-2"
              secondary
            />
            <HeroMetric
              value={stats.avgRuntimeMinutes > 0 ? formatRuntime(stats.avgRuntimeMinutes) : "—"}
              label="Avg runtime"
              valueClass="text-text-2"
              secondary
              border
            />
            <HeroMetric
              value={stats.favDecade ?? "—"}
              label="Fav decade"
              valueClass="text-text-2"
              secondary
              border
            />
          </>
        )}
      </div>

      <div className="h-px bg-divider" />

      {hasData ? (
        <>
          <MoviesOverTime
            monthBuckets={stats.monthBuckets}
            yearBuckets={stats.yearBuckets}
            tagFilter={tagFilter}
            returnTo={statsHref}
          />

          <div className="h-px bg-divider" />

          <SectionHeader title="By genre" />
          {stats.genreBreakdown.length === 0 ? (
            <EmptyBreakdown />
          ) : (
            <GenreTreemap
              items={stats.genreBreakdown}
              colors={GENRE_COLORS}
              hrefForItem={(item) => moviesFilterHref({ genre: item.label, tag: tagFilter, returnTo: statsHref })}
            />
          )}

          <div className="h-px bg-divider" />

          <SectionHeader title="By rating" />
          <RatingDistribution breakdown={stats.ratingBreakdown} />

          <div className="h-px bg-divider" />

          <SectionHeader title="By language" />
          {filteredLanguages.length === 0 ? (
            <EmptyBreakdown />
          ) : (
            <LanguageDonut
              items={filteredLanguages}
              hrefForItem={(item) => moviesFilterHref({ language: item.key, tag: tagFilter, returnTo: statsHref })}
            />
          )}

          <div className="h-px bg-divider" />

          <SectionHeader title="By tag" />
          {stats.tagBreakdown.length === 0 ? (
            <p className="pb-4 text-[15px] leading-[1.4] text-text-muted">No tagged watched movies yet.</p>
          ) : (
            <BarBreakdown items={stats.tagBreakdown} barColor="rgba(255,159,10,0.45)" />
          )}
        </>
      ) : (
        <p className="pt-6 text-[15px] leading-[1.4] text-text-2">
          No watch history yet. Mark a movie watched to see stats.
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

function SectionHeader({ title }: { title: string }) {
  return (
    <p className="pt-4 pb-2 text-[17px] font-semibold">{title}</p>
  );
}

function EmptyBreakdown() {
  return <p className="pb-4 text-[15px] leading-[1.4] text-text-muted">No data yet.</p>;
}

function BarBreakdown({
  items,
  barColor,
}: {
  items: LibraryStatsBreakdownItem[];
  barColor: string;
}) {
  const maxCount = Math.max(...items.map((i) => i.count), 1);
  const unknownItems = items.filter((i) => i.key === "unknown");
  const knownItems = items.filter((i) => i.key !== "unknown");
  const ordered = [...knownItems, ...unknownItems];

  return (
    <div className="pb-2">
      {ordered.map((item) => {
        const isUnknown = item.key === "unknown";
        const pct = Math.max((item.count / maxCount) * 100, 2);
        return (
          <div
            key={item.key}
            className="flex items-center gap-2.5 border-b border-divider py-2 last:border-b-0"
            style={{ minHeight: 36 }}
          >
            <span
              className={`flex-1 min-w-0 text-[14px] truncate ${isUnknown ? "text-text-muted" : "text-foreground"}`}
            >
              {item.label}
            </span>
            <div className="relative flex-[2] h-[4px] rounded-full overflow-hidden" style={{ background: "var(--bg-secondary)" }}>
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: `${pct}%`,
                  background: isUnknown ? "rgba(0,0,0,0.15)" : barColor,
                }}
              />
            </div>
            <span className={`tabnum w-8 text-right text-[13px] font-medium shrink-0 ${isUnknown ? "text-text-muted" : "text-text-2"}`}>
              {item.count}
            </span>
          </div>
        );
      })}
    </div>
  );
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
    <div className="pb-4 flex flex-col" style={{ gap: 2 }}>
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
      aria-label={`View ${item.label} movies`}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "rgba(255,255,255,0.88)",
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
          color: "rgba(255,255,255,0.60)",
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
    <div className="flex flex-col items-center gap-3 pb-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {segments.map(({ item, d, color }) => (
          <a key={item.key} href={hrefForItem(item)} aria-label={`View ${item.label} movies`}>
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

function RatingDistribution({ breakdown }: { breakdown: LibraryStatsRatingBucket[] }) {
  const hasRatings = breakdown.some((b) => b.count > 0);
  const maxCount = Math.max(...breakdown.map((b) => b.count), 1);

  if (!hasRatings) {
    return <EmptyBreakdown />;
  }

  return (
    <div className="flex items-end gap-1.5 pb-4" style={{ height: 80, paddingTop: 16 }}>
      {breakdown.map(({ rating, count }) => (
        <div key={rating} className="flex flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t-sm bg-accent transition-all"
            style={{
              height: count > 0 ? `${Math.max((count / maxCount) * 44, 3)}px` : "2px",
              opacity: count > 0 ? 1 : 0.12,
            }}
          />
          <span className="tabnum text-[10px] text-text-faint">{rating}</span>
        </div>
      ))}
    </div>
  );
}

function moviesFilterHref({
  genre,
  language,
  tag,
  month,
  year,
  returnTo,
}: {
  genre?: string;
  language?: string;
  tag?: string;
  month?: string;
  year?: string;
  returnTo: string;
}) {
  const params = new URLSearchParams();
  params.set("from", "stats");
  params.set("returnTo", returnTo);
  if (tag) params.set("tag", tag);
  if (genre) params.set("genre", genre);
  if (language) params.set("language", language);
  if (month) params.set("month", month);
  if (year) params.set("year", year);
  return `/movies?${params.toString()}`;
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
