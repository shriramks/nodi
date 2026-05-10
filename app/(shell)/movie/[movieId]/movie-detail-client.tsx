"use client";

import { type FormEvent, useState, useTransition } from "react";
import { CalendarPlus, Check, ChevronDown, Heart, Plus, Tag, X } from "lucide-react";
import {
  addTagAction,
  addToWatchlistAction,
  addWatchDateAction,
  markWatchedAction,
  removeFromLibraryAction,
  removeTagAction,
  updateRatingAction,
} from "./actions";

type WatchStatus = "watched" | "to_watch" | null;
type MovieTag = {
  id: string;
  name: string;
};

function todayDateValue() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

export function UserStateActions({
  movieId,
  status,
}: {
  movieId: string;
  status: WatchStatus;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch {
        setError("Something went wrong. Try again.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-3">
        {status !== "watched" && (
          <button
            onClick={() => run(() => markWatchedAction(movieId))}
            disabled={isPending}
            className="h-11 flex-1 rounded-xl bg-accent/15 px-4 text-[15px] font-semibold text-accent disabled:opacity-50"
          >
            {isPending ? "…" : "Mark Watched"}
          </button>
        )}

        {status === null && (
          <button
            onClick={() => run(() => addToWatchlistAction(movieId))}
            disabled={isPending}
            className="h-11 flex-1 rounded-xl border border-border px-4 text-[15px] font-semibold text-text-2 disabled:opacity-50"
          >
            + Watchlist
          </button>
        )}

        {status === "to_watch" && (
          <button
            onClick={() => run(() => removeFromLibraryAction(movieId))}
            disabled={isPending}
            className="h-11 rounded-xl border border-border px-4 text-[15px] font-semibold text-unsynced disabled:opacity-50"
          >
            {isPending ? "…" : "Remove"}
          </button>
        )}

        {status === "watched" && (
          <button
            onClick={() => run(() => removeFromLibraryAction(movieId))}
            disabled={isPending}
            className="h-11 flex-1 rounded-xl border border-border px-4 text-[15px] font-semibold text-unsynced disabled:opacity-50"
          >
            {isPending ? "…" : "Remove from Library"}
          </button>
        )}
      </div>

      {error ? (
        <p className="text-[13px] text-unsynced">{error}</p>
      ) : null}
    </div>
  );
}

const RATING_LABELS: Record<number, string> = {
  1: "Awful",
  2: "Bad",
  3: "Poor",
  4: "Below Average",
  5: "Average",
  6: "Fine",
  7: "Good",
  8: "Great",
  9: "Excellent",
  10: "Masterpiece",
};

export function RatingSheet({
  movieId,
  currentRating,
}: {
  movieId: string;
  currentRating: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRate(n: number | null) {
    setError(null);
    startTransition(async () => {
      try {
        await updateRatingAction(movieId, n);
        setOpen(false);
      } catch {
        setError("Rating was not saved. Try again.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-[15px] text-foreground"
        aria-label={currentRating !== null ? `Rating: ${currentRating}. Tap to change` : "Tap to rate"}
      >
        <Heart
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-text-muted"
          strokeWidth={1.8}
        />
        <span>{currentRating !== null ? currentRating : "Rate"}</span>
        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 text-text-muted" strokeWidth={2} />
      </button>

      {open && (
        <>
          <div
            aria-hidden="true"
            className="fixed inset-0 z-40 bg-black/60"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Your Rating"
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-[var(--bg-secondary)] px-5 pt-3"
            style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}
          >
            <div className="mx-auto mb-5 mt-2 h-1 w-9 rounded-full bg-[var(--bg-tertiary)]" />

            <p className="mb-2 text-[17px] font-semibold text-foreground">Your Rating</p>

            <div>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => handleRate(n)}
                  disabled={isPending}
                  className={[
                    "flex w-full items-center justify-between border-b border-[var(--divider)] py-3 text-left last:border-b-0 disabled:opacity-50",
                    currentRating === n ? "text-accent" : "",
                  ].join(" ")}
                >
                  <span className="flex items-baseline gap-3 text-[15px]">
                    <span className="tabnum w-4 font-semibold">{n}</span>
                    <span className={currentRating === n ? "text-accent" : "text-text-2"}>
                      {RATING_LABELS[n]}
                    </span>
                  </span>
                  {currentRating === n && (
                    <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-accent" strokeWidth={2.5} />
                  )}
                </button>
              ))}
            </div>

            {currentRating !== null && (
              <button
                type="button"
                onClick={() => handleRate(null)}
                disabled={isPending}
                className="mt-4 h-11 w-full rounded-xl border border-[var(--border)] text-[15px] font-semibold text-text-2 disabled:opacity-50"
              >
                Clear rating
              </button>
            )}

            {error && <p className="mt-2 text-[13px] text-unsynced">{error}</p>}
          </div>
        </>
      )}
    </>
  );
}

export function WatchDateForm({ movieId }: { movieId: string }) {
  const [watchedDate, setWatchedDate] = useState(() => todayDateValue());
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const today = todayDateValue();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        await addWatchDateAction(movieId, watchedDate);
      } catch {
        setError("Watch date was not saved. Try again.");
      }
    });
  }

  return (
    <form className="space-y-2" onSubmit={handleSubmit}>
      <div className="flex gap-2">
        <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-surface px-3">
          <CalendarPlus
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-text-muted"
            strokeWidth={1.8}
          />
          <input
            aria-label="Watch date"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none"
            max={today}
            onChange={(event) => setWatchedDate(event.target.value)}
            type="date"
            value={watchedDate}
          />
        </label>

        <button
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-accent/15 px-3 text-[13px] font-semibold text-accent disabled:opacity-50"
          disabled={isPending || !watchedDate}
          type="submit"
        >
          <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
          Add
        </button>
      </div>

      {error ? <p className="text-[13px] text-unsynced">{error}</p> : null}
    </form>
  );
}

export function TagEditor({
  movieId,
  tags,
}: {
  movieId: string;
  tags: MovieTag[];
}) {
  const [tagName, setTagName] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextTagName = tagName.replace(/\s+/g, " ").trim();

    if (!nextTagName) {
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        await addTagAction(movieId, nextTagName);
        setTagName("");
      } catch {
        setError("Tag was not saved. Try again.");
      }
    });
  }

  function handleRemove(tagId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await removeTagAction(movieId, tagId);
      } catch {
        setError("Tag was not removed. Try again.");
      }
    });
  }

  return (
    <section className="space-y-2">
      <form className="flex gap-2" onSubmit={handleAdd}>
        <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-surface px-3">
          <Tag
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-text-muted"
            strokeWidth={1.8}
          />
          <input
            aria-label="Tag name"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-text-muted"
            maxLength={80}
            onChange={(event) => setTagName(event.target.value)}
            placeholder="Add tag"
            value={tagName}
          />
        </label>

        <button
          aria-label="Add tag"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent disabled:opacity-50"
          disabled={isPending || tagName.trim().length === 0}
          title="Add tag"
          type="submit"
        >
          <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
        </button>
      </form>

      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-[13px] text-text-2"
            >
              <span className="truncate">{tag.name}</span>
              <button
                aria-label={`Remove ${tag.name}`}
                className="-mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-tap-active hover:text-foreground disabled:opacity-50"
                disabled={isPending}
                onClick={() => handleRemove(tag.id)}
                title={`Remove ${tag.name}`}
                type="button"
              >
                <X aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {error ? <p className="text-[13px] text-unsynced">{error}</p> : null}
    </section>
  );
}
