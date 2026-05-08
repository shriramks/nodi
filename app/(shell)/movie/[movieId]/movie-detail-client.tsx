"use client";

import { type FormEvent, useState, useTransition } from "react";
import { CalendarPlus, Heart, Plus, Tag, X } from "lucide-react";
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

export function RatingPicker({
  movieId,
  currentRating,
}: {
  movieId: string;
  currentRating: number | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRate(n: number) {
    const next = currentRating === n ? null : n;
    setError(null);
    startTransition(async () => {
      try {
        await updateRatingAction(movieId, next);
      } catch {
        setError("Rating was not saved. Try again.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Heart
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-text-muted"
          strokeWidth={1.8}
        />
        <div className="flex flex-1 gap-1">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => handleRate(n)}
              disabled={isPending}
              style={{ flex: "1 1 0" }}
              className={[
                "flex h-8 min-w-0 items-center justify-center rounded-lg text-[12px] font-semibold transition-colors disabled:opacity-50",
                currentRating === n
                  ? "bg-accent/15 text-accent"
                  : "border border-border text-text-2",
              ].join(" ")}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="text-[13px] text-unsynced">{error}</p> : null}
    </div>
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
