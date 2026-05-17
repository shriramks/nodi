"use client";

import { type FormEvent, useState, useTransition } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Heart,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
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
  const [pendingAction, setPendingAction] = useState<"watch" | "watchlist" | "remove" | null>(null);

  function run(
    pendingKey: "watch" | "watchlist" | "remove",
    action: () => Promise<void>,
  ) {
    setError(null);
    setPendingAction(pendingKey);
    startTransition(async () => {
      try {
        await action();
      } catch {
        setError("Something went wrong. Try again.");
      } finally {
        setPendingAction(null);
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-3">
        {status !== "watched" && (
          <button
            onClick={() => run("watch", () => markWatchedAction(movieId))}
            disabled={isPending}
            className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-xl bg-accent/15 px-4 text-[15px] font-semibold text-accent active:opacity-70 disabled:opacity-50"
          >
            {pendingAction === "watch" ? (
              <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" strokeWidth={2.2} />
            ) : null}
            Mark Watched
          </button>
        )}

        {status === null && (
          <button
            onClick={() => run("watchlist", () => addToWatchlistAction(movieId))}
            disabled={isPending}
            className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-xl border border-border px-4 text-[15px] font-semibold text-text-2 active:opacity-70 disabled:opacity-50"
          >
            {pendingAction === "watchlist" ? (
              <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" strokeWidth={2.2} />
            ) : null}
            + Watchlist
          </button>
        )}

        {status === "to_watch" && (
          <button
            onClick={() => run("remove", () => removeFromLibraryAction(movieId))}
            disabled={isPending}
            className="flex h-[50px] items-center justify-center gap-2 rounded-xl border border-border px-4 text-[15px] font-semibold text-unsynced active:opacity-70 disabled:opacity-50"
          >
            {pendingAction === "remove" ? (
              <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" strokeWidth={2.2} />
            ) : null}
            Remove
          </button>
        )}

        {status === "watched" && (
          <button
            onClick={() => run("remove", () => removeFromLibraryAction(movieId))}
            disabled={isPending}
            className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-xl border border-border px-4 text-[15px] font-semibold text-unsynced active:opacity-70 disabled:opacity-50"
          >
            {pendingAction === "remove" ? (
              <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" strokeWidth={2.2} />
            ) : null}
            Remove from Library
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
  const [pendingRating, setPendingRating] = useState<number | "clear" | null>(null);

  function handleRate(n: number | null) {
    setError(null);
    setPendingRating(n ?? "clear");
    startTransition(async () => {
      try {
        await updateRatingAction(movieId, n);
        setOpen(false);
      } catch {
        setError("Rating was not saved. Try again.");
      } finally {
        setPendingRating(null);
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
                {pendingRating === n ? (
                  <LoaderCircle
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 animate-spin text-accent"
                    strokeWidth={2.2}
                  />
                ) : currentRating === n ? (
                  <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-accent" strokeWidth={2.5} />
                ) : null}
              </button>
            ))}
          </div>

          {currentRating !== null && (
            <button
              type="button"
              onClick={() => handleRate(null)}
              disabled={isPending}
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border text-[15px] font-semibold text-text-2 active:opacity-70 disabled:opacity-50"
            >
              {pendingRating === "clear" ? (
                <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" strokeWidth={2.2} />
              ) : null}
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
    <section className="mt-4 space-y-2">
      <p className="text-[11px] uppercase tracking-wide text-text-muted">Log rewatch</p>
      <div className="flex items-center border-b border-divider" style={{ minHeight: 44 }}>
        <span className="mr-3 shrink-0 text-[13px] text-text-faint">Watched on</span>
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
          className="ml-3 flex shrink-0 items-center justify-end gap-1.5 text-[15px] font-semibold text-accent disabled:opacity-40 active:opacity-60"
          style={{ minHeight: 44, minWidth: 44 }}
        >
          {isPending ? (
            <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" strokeWidth={2.2} />
          ) : null}
          Log
        </button>
      </div>
      {error ? <p className="pt-1 text-[13px] text-unsynced">{error}</p> : null}
    </section>
  );
}

type WatchLog = { id: string; watched_at: string };

function sortedWatchLogs(watchLogs: WatchLog[]) {
  return [...watchLogs].sort(
    (left, right) => Date.parse(right.watched_at) - Date.parse(left.watched_at),
  );
}

function formatLogDate(isoString: string): string {
  const d = new Date(isoString);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function WatchedSummary({ watchLogs }: { watchLogs: WatchLog[] }) {
  const latestWatch = sortedWatchLogs(watchLogs)[0] ?? null;

  if (!latestWatch) {
    return <p className="text-[15px] font-semibold text-watched">Watched</p>;
  }

  return (
    <div className="flex flex-wrap items-baseline gap-1.5 leading-[1.35]">
      <p className="text-[15px] font-semibold text-watched">
        {watchLogs.length > 1 ? `Watched x${watchLogs.length}` : "Watched"}
      </p>
      <p className="text-[13px] text-text-2">
        ·{" "}
        {watchLogs.length > 1
          ? `Last watched ${formatLogDate(latestWatch.watched_at)}`
          : formatLogDate(latestWatch.watched_at)}
      </p>
    </div>
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
  const [isCreatingTag, setIsCreatingTag] = useState(false);

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
    setIsCreatingTag(true);
    startTransition(async () => {
      try {
        await addTagAction(movieId, name);
        setNewTagName("");
      } catch {
        setError("Tag could not be saved. Try again.");
      } finally {
        setIsCreatingTag(false);
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
          className="flex shrink-0 items-center justify-end gap-1.5 text-[15px] font-semibold text-accent disabled:opacity-40 active:opacity-60"
          style={{ minHeight: 44, minWidth: 44 }}
        >
          {isCreatingTag ? (
            <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" strokeWidth={2.2} />
          ) : null}
          Add
        </button>
      </form>

      {error ? <p className="px-4 pt-1 text-[13px] text-unsynced">{error}</p> : null}
    </section>
  );
}

export function WatchHistoryEditor({
  movieId,
  watchLogs,
}: {
  movieId: string;
  watchLogs: WatchLog[];
}) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pendingLogAction, setPendingLogAction] = useState<
    { kind: "save" | "delete"; logId: string } | null
  >(null);
  const today = todayDateValue();
  const orderedLogs = sortedWatchLogs(watchLogs);

  function closeSheet() {
    setOpen(false);
    setEditingId(null);
    setEditDate("");
    setError(null);
  }

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
    setPendingLogAction({ kind: "save", logId });
    startTransition(async () => {
      try {
        await updateWatchLogDateAction(movieId, logId, editDate);
        setEditingId(null);
      } catch {
        setError("Date could not be saved. Try again.");
      } finally {
        setPendingLogAction(null);
      }
    });
  }

  function handleDelete(logId: string) {
    setError(null);
    setPendingLogAction({ kind: "delete", logId });
    startTransition(async () => {
      try {
        await deleteWatchLogAction(movieId, logId);
        if (editingId === logId) setEditingId(null);
      } catch {
        setError("Entry could not be deleted. Try again.");
      } finally {
        setPendingLogAction(null);
      }
    });
  }

  if (watchLogs.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-[44px] w-full items-center justify-between border-t border-divider text-left active:opacity-70"
      >
        <span className="text-[15px] text-foreground">Watch history</span>
        <span className="flex items-center gap-1 text-[13px] text-text-muted">
          {watchLogs.length} {watchLogs.length === 1 ? "watch" : "watches"}
          <ChevronRight aria-hidden="true" className="h-4 w-4 text-text-faint" strokeWidth={2} />
        </span>
      </button>

      {open ? (
        <BottomSheet
          ariaLabel="Watch history"
          dismissButtonLabel="Close watch history"
          onClose={closeSheet}
        >
          <p className="mb-2 text-[17px] font-semibold text-foreground">Watch history</p>

          <div>
            {orderedLogs.map((log) =>
              editingId === log.id ? (
                <div
                  key={log.id}
                  className="flex min-h-[44px] items-center gap-2 border-b border-divider py-2 last:border-b-0"
                >
                  <label className="relative flex min-w-0 flex-1 cursor-pointer items-center gap-1.5">
                    <span className="text-[15px] text-foreground">
                      {editDate
                        ? new Intl.DateTimeFormat("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          }).format(new Date(`${editDate}T12:00:00`))
                        : "Pick a date"}
                    </span>
                    <ChevronDown
                      aria-hidden="true"
                      className="h-3.5 w-3.5 shrink-0 text-text-muted"
                      strokeWidth={2}
                    />
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
                    className="flex items-center gap-1.5 text-[15px] font-semibold text-accent disabled:opacity-40 active:opacity-60"
                    style={{
                      minHeight: 44,
                      minWidth: 44,
                      justifyContent: "flex-end",
                    }}
                  >
                    {pendingLogAction?.kind === "save" && pendingLogAction.logId === log.id ? (
                      <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" strokeWidth={2.2} />
                    ) : null}
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={isPending}
                    className="text-text-2 active:opacity-60 disabled:opacity-40"
                    style={{
                      minHeight: 44,
                      minWidth: 44,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <X aria-label="Cancel" className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>
              ) : (
                <div
                  key={log.id}
                  className="flex min-h-[44px] items-center gap-2 border-b border-divider py-2 last:border-b-0"
                >
                  <span className="tabnum flex-1 text-[15px] font-semibold text-foreground">
                    {formatLogDate(log.watched_at)}
                  </span>
                  <button
                    type="button"
                    onClick={() => startEdit(log)}
                    disabled={isPending}
                    aria-label="Edit date"
                    className="text-text-muted active:opacity-60 disabled:opacity-40"
                    style={{
                      minHeight: 44,
                      minWidth: 44,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Pencil aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(log.id)}
                    disabled={isPending}
                    aria-label="Delete entry"
                    className="text-unsynced active:opacity-60 disabled:opacity-40"
                    style={{
                      minHeight: 44,
                      minWidth: 44,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {pendingLogAction?.kind === "delete" && pendingLogAction.logId === log.id ? (
                      <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" strokeWidth={2.2} />
                    ) : (
                      <Trash2 aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
                    )}
                  </button>
                </div>
              ),
            )}
          </div>

          <WatchDateForm movieId={movieId} />

          {error && <p className="mt-2 text-[13px] text-unsynced">{error}</p>}
        </BottomSheet>
      ) : null}
    </>
  );
}
