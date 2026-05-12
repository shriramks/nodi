"use client";

import { type FormEvent, useState, useTransition } from "react";
import { Check, ChevronDown, Heart, Pencil, Plus, Trash2, X } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}
import {
  addTagAction,
  addToWatchlistAction,
  addWatchDateAction,
  attachTagByIdAction,
  deleteWatchLogAction,
  markWatchedAction,
  removeFromLibraryAction,
  removeTagAction,
  updateRatingAction,
  updateWatchLogDateAction,
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
            className="h-[50px] flex-1 rounded-xl bg-accent/15 px-4 text-[15px] font-semibold text-accent active:opacity-70 disabled:opacity-50"
          >
            {isPending ? "…" : "Mark Watched"}
          </button>
        )}

        {status === null && (
          <button
            onClick={() => run(() => addToWatchlistAction(movieId))}
            disabled={isPending}
            className="h-[50px] flex-1 rounded-xl border border-border px-4 text-[15px] font-semibold text-text-2 active:opacity-70 disabled:opacity-50"
          >
            + Watchlist
          </button>
        )}

        {status === "to_watch" && (
          <button
            onClick={() => run(() => removeFromLibraryAction(movieId))}
            disabled={isPending}
            className="h-[50px] rounded-xl border border-border px-4 text-[15px] font-semibold text-unsynced active:opacity-70 disabled:opacity-50"
          >
            {isPending ? "…" : "Remove"}
          </button>
        )}

        {status === "watched" && (
          <button
            onClick={() => run(() => removeFromLibraryAction(movieId))}
            disabled={isPending}
            className="h-[50px] flex-1 rounded-xl border border-border px-4 text-[15px] font-semibold text-unsynced active:opacity-70 disabled:opacity-50"
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
        className={[
          "flex items-center gap-1.5 text-[15px] active:opacity-70",
          currentRating !== null ? "text-accent" : "text-foreground",
        ].join(" ")}
        style={{ minHeight: 44 }}
        aria-label={currentRating !== null ? `Rating: ${currentRating}. Tap to change` : "Tap to rate"}
      >
        <Heart
          aria-hidden="true"
          className={[
            "h-5 w-5 shrink-0",
            currentRating !== null ? "fill-accent/20 text-accent" : "text-text-muted",
          ].join(" ")}
          strokeWidth={1.8}
        />
        <span className="font-semibold">{currentRating !== null ? currentRating : "Rate"}</span>
        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 text-text-muted" strokeWidth={2} />
      </button>

      {open && (
        <BottomSheet ariaLabel="Your Rating" onClose={() => setOpen(false)}>
          <p className="mb-2 text-[17px] font-semibold text-foreground">Your Rating</p>

          <div>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => handleRate(n)}
                disabled={isPending}
                className="flex w-full items-center gap-3 border-b border-divider py-3 text-left last:border-b-0 active:opacity-70 disabled:opacity-50"
              >
                <span
                  className={[
                    "tabnum w-5 shrink-0 text-[17px] font-semibold",
                    currentRating === n ? "text-accent" : "text-foreground",
                  ].join(" ")}
                >
                  {n}
                </span>
                <span
                  className={[
                    "flex-1 text-[15px]",
                    currentRating === n ? "text-accent" : "text-text-2",
                  ].join(" ")}
                >
                  {RATING_LABELS[n]}
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
              className="mt-4 h-11 w-full rounded-xl border border-border text-[15px] font-semibold text-text-2 active:opacity-70 disabled:opacity-50"
            >
              Clear rating
            </button>
          )}

          {error && <p className="mt-2 text-[13px] text-unsynced">{error}</p>}
        </BottomSheet>
      )}
    </>
  );
}

export function WatchDateForm({ movieId }: { movieId: string }) {
  const [watchedDate, setWatchedDate] = useState(() => todayDateValue());
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const today = todayDateValue();

  function handleAdd() {
    if (!watchedDate) return;
    setError(null);
    startTransition(async () => {
      try {
        await addWatchDateAction(movieId, watchedDate);
      } catch {
        setError("Watch date was not saved. Try again.");
      }
    });
  }

  const displayDate = watchedDate
    ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
        parseLocalDate(watchedDate),
      )
    : "Pick a date";

  return (
    <section>
      <div className="flex items-center border-b border-divider px-4" style={{ minHeight: 44 }}>
        <span className="text-[13px] text-text-faint mr-3 shrink-0">Watched on</span>
        <label className="relative flex flex-1 cursor-pointer items-center gap-2 min-w-0 justify-end">
          <span className="text-[15px] text-foreground">{displayDate}</span>
          <ChevronDown
            aria-hidden="true"
            className="h-3.5 w-3.5 shrink-0 text-text-muted"
            strokeWidth={2}
          />
          <input
            aria-label="Watch date"
            className="absolute inset-0 cursor-pointer opacity-0"
            max={today}
            onChange={(e) => setWatchedDate(e.target.value)}
            type="date"
            value={watchedDate}
          />
        </label>
        <button
          onClick={handleAdd}
          disabled={isPending || !watchedDate}
          className="ml-3 shrink-0 text-[15px] font-semibold text-accent disabled:opacity-40 active:opacity-60"
          style={{ minHeight: 44, minWidth: 44, display: "flex", alignItems: "center", justifyContent: "flex-end" }}
        >
          {isPending ? "…" : "Add"}
        </button>
      </div>
      {error ? <p className="px-4 pt-1 text-[13px] text-unsynced">{error}</p> : null}
    </section>
  );
}

export function TagEditor({
  movieId,
  tags,
  allTags,
}: {
  movieId: string;
  tags: MovieTag[];
  allTags: MovieTag[];
}) {
  const [newTagName, setNewTagName] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const movieTagIds = new Set(tags.map((t) => t.id));

  const searchTerm = newTagName.toLowerCase().trim();
  const suggestions =
    searchTerm.length > 0
      ? allTags.filter((t) => !movieTagIds.has(t.id) && t.name.toLowerCase().includes(searchTerm))
      : [];

  function handleAttach(tagId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await attachTagByIdAction(movieId, tagId);
      } catch {
        setError("Tag could not be added. Try again.");
      }
    });
  }

  function handleRemove(tagId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await removeTagAction(movieId, tagId);
      } catch {
        setError("Tag could not be removed. Try again.");
      }
    });
  }

  function handleCreateNew(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newTagName.replace(/\s+/g, " ").trim();
    if (!name) return;
    setError(null);
    startTransition(async () => {
      try {
        await addTagAction(movieId, name);
        setNewTagName("");
      } catch {
        setError("Tag could not be saved. Try again.");
      }
    });
  }

  return (
    <section>
      <p className="px-4 py-1 text-[11px] uppercase tracking-wide text-text-faint">
        Tags
      </p>

      {/* Current tags — single scrollable row */}
      {tags.length > 0 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-3 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => handleRemove(tag.id)}
              disabled={isPending}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-accent/12 px-2.5 text-[13px] font-medium text-accent active:opacity-70 disabled:opacity-50"
            >
              <span>{tag.name}</span>
              <X aria-hidden="true" className="h-3 w-3 opacity-60" strokeWidth={2.5} />
            </button>
          ))}
        </div>
      )}

      {/* Search-filtered suggestions — only visible while typing */}
      {suggestions.length > 0 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {suggestions.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => handleAttach(tag.id)}
              disabled={isPending}
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 text-[13px] text-text-2 active:opacity-70 disabled:opacity-50"
            >
              <Plus aria-hidden="true" className="h-3 w-3 opacity-50" strokeWidth={2.5} />
              <span>{tag.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* New tag input */}
      <form className="flex items-center gap-1 border-t border-divider px-4 py-2" onSubmit={handleCreateNew}>
        <input
          aria-label="New tag name"
          className="min-w-0 flex-1 bg-transparent py-2 text-[15px] text-foreground outline-none placeholder:text-text-muted"
          maxLength={80}
          onChange={(e) => setNewTagName(e.target.value)}
          placeholder="New tag…"
          value={newTagName}
        />
        <button
          aria-label="Add tag"
          disabled={isPending || newTagName.trim().length === 0}
          type="submit"
          className="shrink-0 text-[15px] font-semibold text-accent disabled:opacity-40 active:opacity-60"
          style={{ minHeight: 44, minWidth: 44, display: "flex", alignItems: "center", justifyContent: "flex-end" }}
        >
          {isPending ? "…" : "Add"}
        </button>
      </form>

      {error ? <p className="px-4 pt-1 text-[13px] text-unsynced">{error}</p> : null}
    </section>
  );
}

type WatchLog = { id: string; watched_at: string };

function formatLogDate(isoString: string): string {
  const d = new Date(isoString);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function WatchHistoryEditor({
  movieId,
  watchLogs,
}: {
  movieId: string;
  watchLogs: WatchLog[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const today = todayDateValue();

  function startEdit(log: WatchLog) {
    setEditingId(log.id);
    setEditDate(log.watched_at.slice(0, 10));
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDate("");
    setError(null);
  }

  function handleSave(logId: string) {
    if (!editDate) return;
    setError(null);
    startTransition(async () => {
      try {
        await updateWatchLogDateAction(movieId, logId, editDate);
        setEditingId(null);
      } catch {
        setError("Date could not be saved. Try again.");
      }
    });
  }

  function handleDelete(logId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await deleteWatchLogAction(movieId, logId);
        if (editingId === logId) setEditingId(null);
      } catch {
        setError("Entry could not be deleted. Try again.");
      }
    });
  }

  if (watchLogs.length === 0) return null;

  return (
    <section className="space-y-2">
      <p className="text-[11px] uppercase tracking-wide text-text-muted">
        Watch history{watchLogs.length > 1 ? ` · ${watchLogs.length}×` : ""}
      </p>

      <div>
        {watchLogs.map((log) =>
          editingId === log.id ? (
            <div
              key={log.id}
              className="flex min-h-[44px] items-center gap-2 border-b border-divider px-4 py-2 last:border-b-0"
            >
              <label className="relative flex flex-1 cursor-pointer items-center gap-1.5 min-w-0">
                <span className="text-[15px] text-foreground">
                  {editDate
                    ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(editDate + "T12:00:00"))
                    : "Pick a date"}
                </span>
                <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-text-muted" strokeWidth={2} />
                <input
                  aria-label="Edit watch date"
                  className="absolute inset-0 cursor-pointer opacity-0"
                  max={today}
                  onChange={(e) => setEditDate(e.target.value)}
                  type="date"
                  value={editDate}
                />
              </label>
              <button
                type="button"
                onClick={() => handleSave(log.id)}
                disabled={isPending || !editDate}
                className="text-[15px] font-semibold text-accent disabled:opacity-40 active:opacity-60"
                style={{ minHeight: 44, minWidth: 44, display: "flex", alignItems: "center", justifyContent: "flex-end" }}
              >
                Save
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                disabled={isPending}
                className="text-text-2 active:opacity-60 disabled:opacity-40"
                style={{ minHeight: 44, minWidth: 44, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X aria-label="Cancel" className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          ) : (
            <div
              key={log.id}
              className="flex min-h-[44px] items-center gap-2 border-b border-divider px-4 py-2 last:border-b-0"
            >
              <span className="flex-1 text-[15px] text-text-2">Watched</span>
              <span className="tabnum text-[15px] font-semibold text-foreground">
                {formatLogDate(log.watched_at)}
              </span>
              <button
                type="button"
                onClick={() => startEdit(log)}
                disabled={isPending}
                aria-label="Edit date"
                className="text-text-muted active:opacity-60 disabled:opacity-40"
                style={{ minHeight: 44, minWidth: 44, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <Pencil aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(log.id)}
                disabled={isPending}
                aria-label="Delete entry"
                className="text-unsynced active:opacity-60 disabled:opacity-40"
                style={{ minHeight: 44, minWidth: 44, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </div>
          )
        )}
      </div>

      {error && <p className="px-4 text-[13px] text-unsynced">{error}</p>}
    </section>
  );
}
