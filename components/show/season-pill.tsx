"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type SeasonPillSeason = {
  episodeIds: string[];
  seasonNumber: number;
};

type Tick = {
  domId: string;
  seasonNumber: number;
  kind: "episode" | "season";
};

// Matches the sticky page header (78px) so a target lands just below it.
const HEADER_OFFSET = 78;
const SEASON_BAR_OFFSET = 40;
const DRIVER_RELEASE_MS = 150;

export function seasonDomId(seasonNumber: number) {
  return `season-${seasonNumber}`;
}

export function episodeDomId(episodeId: string) {
  return `episode-${episodeId}`;
}

// Floating scrubber for the episode list: season numbers are labels, ticks are episodes. Dragging
// scrolls the page to the picked season/episode; scrolling the page moves the centre line.
export function SeasonPill({
  expandedSeasons,
  initialEpisodeId,
  onExpandSeason,
  seasons,
}: {
  expandedSeasons: ReadonlySet<number>;
  initialEpisodeId?: string | null;
  onExpandSeason: (seasonNumber: number) => void;
  seasons: SeasonPillSeason[];
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const tickRefs = useRef<(HTMLDivElement | null)[]>([]);
  const driverRef = useRef<"strip" | "page" | null>(null);
  const releaseRef = useRef<number | undefined>(undefined);
  const expandedRef = useRef(expandedSeasons);

  useEffect(() => {
    expandedRef.current = expandedSeasons;
  }, [expandedSeasons]);

  const ticks = useMemo<Tick[]>(
    () =>
      seasons.flatMap((season) => [
        {
          domId: seasonDomId(season.seasonNumber),
          kind: "season" as const,
          seasonNumber: season.seasonNumber,
        },
        ...season.episodeIds.map((id) => ({
          domId: episodeDomId(id),
          kind: "episode" as const,
          seasonNumber: season.seasonNumber,
        })),
      ]),
    [seasons],
  );
  const initialIndex = initialEpisodeId
    ? ticks.findIndex((tick) => tick.domId === episodeDomId(initialEpisodeId))
    : -1;

  const [current, setCurrent] = useState(() => Math.max(0, initialIndex));

  function claim(driver: "strip" | "page") {
    driverRef.current = driver;
    window.clearTimeout(releaseRef.current);
    releaseRef.current = window.setTimeout(() => {
      driverRef.current = null;
    }, DRIVER_RELEASE_MS);
  }

  function centerStripOn(index: number) {
    const strip = stripRef.current;
    const el = tickRefs.current[index];
    if (!strip || !el) return;
    strip.scrollLeft = el.offsetLeft + el.offsetWidth / 2 - strip.clientWidth / 2;
  }

  function scrollPageTo(tick: Tick) {
    const el = document.getElementById(tick.domId);
    if (!el) return;
    const offset = tick.kind === "season" ? HEADER_OFFSET : HEADER_OFFSET + SEASON_BAR_OFFSET;
    window.scrollTo({
      behavior: "instant",
      top: el.getBoundingClientRect().top + window.scrollY - offset,
    });
  }

  function handleStripScroll() {
    if (driverRef.current === "page") return;
    const strip = stripRef.current;
    if (!strip) return;
    claim("strip");

    const mid = strip.scrollLeft + strip.clientWidth / 2;
    let best = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    tickRefs.current.forEach((el, index) => {
      if (!el) return;
      const distance = Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    });
    setCurrent(best);

    const tick = ticks[best];
    if (!tick) return;
    if (!expandedRef.current.has(tick.seasonNumber)) {
      // Rows of a collapsed season are not in the DOM yet: expand, then scroll next frame.
      onExpandSeason(tick.seasonNumber);
      window.requestAnimationFrame(() => scrollPageTo(tick));
      return;
    }
    scrollPageTo(tick);
  }

  useEffect(() => {
    let frame = 0;

    function syncFromPage() {
      frame = 0;
      if (driverRef.current === "strip") return;

      let index = 0;
      ticks.forEach((tick, i) => {
        const el = document.getElementById(tick.domId);
        if (!el) return;
        const offset = tick.kind === "season" ? HEADER_OFFSET : HEADER_OFFSET + SEASON_BAR_OFFSET;
        if (el.getBoundingClientRect().top - offset <= 1) index = i;
      });
      claim("page");
      setCurrent(index);
      centerStripOn(index);
    }

    function handlePageScroll() {
      if (driverRef.current === "strip" || frame) return;
      frame = window.requestAnimationFrame(syncFromPage);
    }

    window.addEventListener("scroll", handlePageScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handlePageScroll);
      window.cancelAnimationFrame(frame);
      window.clearTimeout(releaseRef.current);
    };
  }, [ticks]);

  // On landing, open at the last watched episode: centre the pill on it and bring it into view.
  useEffect(() => {
    const index = initialIndex;
    if (index < 0) {
      centerStripOn(0);
      return;
    }
    claim("page");
    centerStripOn(index);
    // Skip the jump when the browser already restored a scroll position (back navigation).
    if (window.scrollY <= 1) scrollPageTo(ticks[index]);
    // Mount only; claim/centerStripOn/scrollPageTo touch refs and the DOM.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentSeason = ticks[current]?.seasonNumber;

  return (
    <div
      className="fixed left-1/2 z-30 h-14 w-[300px] max-w-[calc(100%-32px)] -translate-x-1/2 overflow-hidden rounded-full border border-border bg-nav-surface backdrop-blur-md"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
    >
      <div
        aria-label="Scrub seasons and episodes"
        className="flex h-full items-center overflow-x-auto [&::-webkit-scrollbar]:hidden"
        onScroll={handleStripScroll}
        ref={stripRef}
        style={{ paddingInline: "calc(50% - 3px)", scrollbarWidth: "none" }}
      >
        {ticks.map((tick, index) =>
          tick.kind === "season" ? (
            <div
              className="grid h-full w-8 flex-none place-items-center"
              key={tick.domId}
              ref={(el) => {
                tickRefs.current[index] = el;
              }}
            >
              <span
                className={[
                  "tabnum font-bold transition-all",
                  tick.seasonNumber === currentSeason
                    ? "text-[20px] text-foreground"
                    : "text-[17px] text-text-muted",
                ].join(" ")}
              >
                {tick.seasonNumber}
              </span>
            </div>
          ) : (
            <div
              className="grid h-full w-1.5 flex-none place-items-center"
              key={tick.domId}
              ref={(el) => {
                tickRefs.current[index] = el;
              }}
            >
              <i className="block h-3.5 w-0.5 rounded-sm bg-white/30" />
            </div>
          ),
        )}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-14 bg-gradient-to-r from-nav-surface to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-14 bg-gradient-to-l from-nav-surface to-transparent" />
      <div className="pointer-events-none absolute inset-y-2.5 left-1/2 w-[3px] -translate-x-1/2 rounded-sm bg-accent" />
    </div>
  );
}
