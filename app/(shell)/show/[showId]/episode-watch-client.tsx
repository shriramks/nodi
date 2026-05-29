"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  LoaderCircle,
  Pencil,
  Trash2,
  X,
} from "lucide-react";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { SectionHeader } from "@/components/ui/section";
import {
  addEpisodeWatchDateAction,
  deleteEpisodeWatchActivityAction,
  markSeasonWatchedAction,
  repairShowCompletionStateAction,
  toggleEpisodeWatchedAction,
  updateEpisodeWatchActivityDateAction,
} from "../actions";

type WatchActivity = {
  id: string;
  watched_at: string;
};

function todayDateValue() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatLogDate(isoString: string): string {
  const d = new Date(isoString);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

function sortedActivity(activity: WatchActivity[]) {
  return [...activity].sort(
    (left, right) => Date.parse(right.watched_at) - Date.parse(left.watched_at),
  );
}

export function EpisodeWatchButton({
  episodeId,
  isWatched,
  showId,
}: {
  episodeId: string;
  isWatched: boolean;
  showId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [optimisticWatched, setOptimisticWatched] = useState(isWatched);

  function toggle() {
    const nextWatched = !optimisticWatched;
    setOptimisticWatched(nextWatched);
    startTransition(async () => {
      try {
        await toggleEpisodeWatchedAction(showId, episodeId, nextWatched);
      } catch {
        setOptimisticWatched(!nextWatched);
      }
    });
  }

  return (
    <button
      aria-label={optimisticWatched ? "Mark episode unwatched" : "Mark episode watched"}
      className={[
        "grid h-11 w-11 place-items-center rounded-full active:opacity-70 disabled:opacity-50",
        optimisticWatched ? "bg-accent text-black" : "bg-surface text-text-muted",
      ].join(" ")}
      disabled={isPending}
      onClick={toggle}
      type="button"
    >
      {isPending ? (
        <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" strokeWidth={2.2} />
      ) : (
        <Check aria-hidden="true" className="h-5 w-5" strokeWidth={2.7} />
      )}
    </button>
  );
}

export function SeasonWatchButton({
  seasonNumber,
  showId,
  unwatchedCount,
}: {
  seasonNumber: number;
  showId: string;
  unwatchedCount: number;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function markSeason() {
    setError(null);
    startTransition(async () => {
      try {
        await markSeasonWatchedAction(showId, seasonNumber);
        setConfirmOpen(false);
      } catch {
        setError("Season was not saved. Try again.");
      }
    });
  }

  if (unwatchedCount === 0) {
    return null;
  }

  return (
    <>
      <button
        className="inline-flex min-h-8 items-center px-1 text-[12px] font-bold text-accent active:opacity-70"
        onClick={() => setConfirmOpen(true)}
        type="button"
      >
        Mark all
      </button>

      {confirmOpen ? (
        <BottomSheet
          ariaLabel="Mark season watched"
          contentClassName="px-5 pt-3"
          dismissButtonLabel="Close confirmation"
          onClose={() => setConfirmOpen(false)}
        >
          <p className="text-[17px] font-semibold text-foreground">Mark season watched?</p>
          <p className="mt-2 text-[14px] leading-[1.35] text-text-2">
            {unwatchedCount} {unwatchedCount === 1 ? "episode" : "episodes"} will be marked watched.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              className="flex min-h-11 items-center justify-center rounded-xl border border-border px-3 text-[15px] font-semibold text-text-2 active:opacity-70 disabled:opacity-50"
              disabled={isPending}
              onClick={() => setConfirmOpen(false)}
              type="button"
            >
              Cancel
            </button>
            <button
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-3 text-[15px] font-semibold text-black active:opacity-70 disabled:opacity-50"
              disabled={isPending}
              onClick={markSeason}
              type="button"
            >
              {isPending ? (
                <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" strokeWidth={2.2} />
              ) : null}
              Mark watched
            </button>
          </div>
          {error ? <p className="mt-3 text-[13px] text-unsynced">{error}</p> : null}
        </BottomSheet>
      ) : null}
    </>
  );
}

export function EpisodeDetailActions({
  episodeId,
  isWatched,
  showId,
}: {
  episodeId: string;
  isWatched: boolean;
  showId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"toggle" | "date" | null>(null);
  const [watchedDate, setWatchedDate] = useState(() => todayDateValue());
  const today = todayDateValue();

  function runToggle() {
    setError(null);
    setPendingAction("toggle");
    startTransition(async () => {
      try {
        await toggleEpisodeWatchedAction(showId, episodeId, !isWatched);
      } catch {
        setError("Episode state was not saved. Try again.");
      } finally {
        setPendingAction(null);
      }
    });
  }

  function addDate() {
    if (!watchedDate) return;
    setError(null);
    setPendingAction("date");
    startTransition(async () => {
      try {
        await addEpisodeWatchDateAction(showId, episodeId, watchedDate);
      } catch {
        setError("Watch date was not saved. Try again.");
      } finally {
        setPendingAction(null);
      }
    });
  }

  return (
    <div className="space-y-2 border-b border-divider px-4 py-4">
      <div className="grid grid-cols-2 gap-2">
        <button
          className={[
            "flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-[14px] font-semibold active:opacity-70 disabled:opacity-50",
            isWatched ? "bg-surface text-foreground" : "bg-accent text-black",
          ].join(" ")}
          disabled={isPending}
          onClick={runToggle}
          type="button"
        >
          {pendingAction === "toggle" ? (
            <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" strokeWidth={2.2} />
          ) : null}
          {isWatched ? "Mark unwatched" : "Mark watched"}
        </button>

        <label className="relative flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-surface px-3 text-[14px] font-semibold text-foreground active:opacity-70">
          <span>
            {watchedDate
              ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
                  parseLocalDate(watchedDate),
                )
              : "Watch date"}
          </span>
          <ChevronDown
            aria-hidden="true"
            className="h-3.5 w-3.5 shrink-0 text-text-muted"
            strokeWidth={2}
          />
          <input
            aria-label="Watch date"
            className="absolute inset-0 cursor-pointer opacity-0"
            max={today}
            onChange={(event) => setWatchedDate(event.target.value)}
            type="date"
            value={watchedDate}
          />
        </label>
      </div>

      <button
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent/15 px-3 text-[14px] font-semibold text-accent active:opacity-70 disabled:opacity-50"
        disabled={isPending || !watchedDate}
        onClick={addDate}
        type="button"
      >
        {pendingAction === "date" ? (
          <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" strokeWidth={2.2} />
        ) : null}
        Add watch date
      </button>

      {error ? <p className="text-[13px] text-unsynced">{error}</p> : null}
    </div>
  );
}

export function EpisodeWatchHistoryEditor({
  activity,
  episodeId,
  showId,
}: {
  activity: WatchActivity[];
  episodeId: string;
  showId: string;
}) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<
    { kind: "save" | "delete"; activityId: string } | null
  >(null);
  const orderedActivity = sortedActivity(activity);
  const today = todayDateValue();

  if (activity.length === 0) {
    return null;
  }

  function closeSheet() {
    setOpen(false);
    setEditingId(null);
    setDeleteConfirmId(null);
    setEditDate("");
    setError(null);
  }

  function startEdit(log: WatchActivity) {
    setEditingId(log.id);
    setDeleteConfirmId(null);
    setEditDate(log.watched_at.slice(0, 10));
    setError(null);
  }

  function handleSave(activityId: string) {
    if (!editDate) return;
    setError(null);
    setPendingAction({ kind: "save", activityId });
    startTransition(async () => {
      try {
        await updateEpisodeWatchActivityDateAction(showId, episodeId, activityId, editDate);
        setEditingId(null);
      } catch {
        setError("Date could not be saved. Try again.");
      } finally {
        setPendingAction(null);
      }
    });
  }

  function handleDelete(activityId: string) {
    setError(null);
    setPendingAction({ kind: "delete", activityId });
    startTransition(async () => {
      try {
        await deleteEpisodeWatchActivityAction(showId, episodeId, activityId);
        setDeleteConfirmId(null);
        if (editingId === activityId) setEditingId(null);
      } catch {
        setError("Entry could not be deleted. Try again.");
      } finally {
        setPendingAction(null);
      }
    });
  }

  return (
    <>
      <button
        className="flex min-h-11 w-full items-center justify-between border-b border-divider px-4 text-left active:opacity-70"
        onClick={() => setOpen(true)}
        type="button"
      >
        <span className="text-[15px] text-foreground">Watch history</span>
        <span className="flex items-center gap-1 text-[13px] text-text-muted">
          {activity.length} {activity.length === 1 ? "watch" : "watches"}
          <ChevronRight aria-hidden="true" className="h-4 w-4 text-text-faint" strokeWidth={2} />
        </span>
      </button>

      {open ? (
        <BottomSheet
          ariaLabel="Episode watch history"
          dismissButtonLabel="Close episode watch history"
          onClose={closeSheet}
        >
          <p className="mb-2 text-[17px] font-semibold text-foreground">Watch history</p>

          <div>
            {orderedActivity.map((log) =>
              deleteConfirmId === log.id ? (
                <div
                  className="flex min-h-11 items-center gap-2 border-b border-divider py-2 last:border-b-0"
                  key={log.id}
                >
                  <div className="min-w-0 flex-1">
                    <p className="tabnum text-[15px] font-semibold text-foreground">
                      {formatLogDate(log.watched_at)}
                    </p>
                    <p className="text-[12px] text-text-muted">Delete this watch?</p>
                  </div>
                  <button
                    className="text-[15px] font-medium text-text-2 active:opacity-60 disabled:opacity-40"
                    disabled={isPending}
                    onClick={() => setDeleteConfirmId(null)}
                    style={{ minHeight: 44, minWidth: 54 }}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="flex items-center justify-end gap-1.5 text-[15px] font-semibold text-unsynced active:opacity-60 disabled:opacity-40"
                    disabled={isPending}
                    onClick={() => handleDelete(log.id)}
                    style={{ minHeight: 44, minWidth: 64 }}
                    type="button"
                  >
                    {pendingAction?.kind === "delete" && pendingAction.activityId === log.id ? (
                      <LoaderCircle
                        aria-hidden="true"
                        className="h-4 w-4 animate-spin"
                        strokeWidth={2.2}
                      />
                    ) : null}
                    Delete
                  </button>
                </div>
              ) : editingId === log.id ? (
                <div
                  className="flex min-h-11 items-center gap-2 border-b border-divider py-2 last:border-b-0"
                  key={log.id}
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
                      onChange={(event) => setEditDate(event.target.value)}
                      type="date"
                      value={editDate}
                    />
                  </label>
                  <button
                    className="flex items-center justify-end gap-1.5 text-[15px] font-semibold text-accent disabled:opacity-40 active:opacity-60"
                    disabled={isPending || !editDate}
                    onClick={() => handleSave(log.id)}
                    style={{ minHeight: 44, minWidth: 44 }}
                    type="button"
                  >
                    {pendingAction?.kind === "save" && pendingAction.activityId === log.id ? (
                      <LoaderCircle
                        aria-hidden="true"
                        className="h-4 w-4 animate-spin"
                        strokeWidth={2.2}
                      />
                    ) : null}
                    Save
                  </button>
                  <button
                    aria-label="Cancel"
                    className="grid h-11 w-11 place-items-center text-text-2 active:opacity-60 disabled:opacity-40"
                    disabled={isPending}
                    onClick={() => {
                      setEditingId(null);
                      setEditDate("");
                      setError(null);
                    }}
                    type="button"
                  >
                    <X aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>
              ) : (
                <div
                  className="flex min-h-11 items-center gap-2 border-b border-divider py-2 last:border-b-0"
                  key={log.id}
                >
                  <span className="tabnum flex-1 text-[15px] font-semibold text-foreground">
                    {formatLogDate(log.watched_at)}
                  </span>
                  <button
                    aria-label="Edit watch date"
                    className="grid h-11 w-11 place-items-center text-text-muted active:opacity-60 disabled:opacity-40"
                    disabled={isPending}
                    onClick={() => startEdit(log)}
                    type="button"
                  >
                    <Pencil aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
                  </button>
                  <button
                    aria-label="Delete watch"
                    className="grid h-11 w-11 place-items-center text-unsynced active:opacity-60 disabled:opacity-40"
                    disabled={isPending}
                    onClick={() => setDeleteConfirmId(log.id)}
                    type="button"
                  >
                    {pendingAction?.kind === "delete" && pendingAction.activityId === log.id ? (
                      <LoaderCircle
                        aria-hidden="true"
                        className="h-4 w-4 animate-spin"
                        strokeWidth={2.2}
                      />
                    ) : (
                      <Trash2 aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
                    )}
                  </button>
                </div>
              ),
            )}
          </div>

          <EpisodeWatchDateForm episodeId={episodeId} showId={showId} />

          {error ? <p className="mt-2 text-[13px] text-unsynced">{error}</p> : null}
        </BottomSheet>
      ) : null}
    </>
  );
}

export function ShowCompletionRepair({ showId }: { showId: string }) {
  const [, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      try {
        await repairShowCompletionStateAction(showId);
      } catch {
        // best-effort — stale status stays until next write
      }
    });
  }, [showId]);

  return null;
}

function EpisodeWatchDateForm({
  episodeId,
  showId,
}: {
  episodeId: string;
  showId: string;
}) {
  const [watchedDate, setWatchedDate] = useState(() => todayDateValue());
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const today = todayDateValue();

  function handleAdd() {
    if (!watchedDate) return;
    setError(null);
    startTransition(async () => {
      try {
        await addEpisodeWatchDateAction(showId, episodeId, watchedDate);
      } catch {
        setError("Watch date was not saved. Try again.");
      }
    });
  }

  return (
    <section className="mt-4 space-y-2">
      <SectionHeader>Log watch</SectionHeader>
      <div className="flex min-h-11 items-center border-b border-divider">
        <span className="mr-3 shrink-0 text-[13px] text-text-faint">Watched on</span>
        <label className="relative flex min-w-0 flex-1 cursor-pointer items-center justify-end gap-2">
          <span className="text-[15px] text-foreground">
            {watchedDate
              ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
                  parseLocalDate(watchedDate),
                )
              : "Pick a date"}
          </span>
          <ChevronDown
            aria-hidden="true"
            className="h-3.5 w-3.5 shrink-0 text-text-muted"
            strokeWidth={2}
          />
          <input
            aria-label="Watch date"
            className="absolute inset-0 cursor-pointer opacity-0"
            max={today}
            onChange={(event) => setWatchedDate(event.target.value)}
            type="date"
            value={watchedDate}
          />
        </label>
        <button
          className="ml-3 flex shrink-0 items-center justify-end gap-1.5 text-[15px] font-semibold text-accent disabled:opacity-40 active:opacity-60"
          disabled={isPending || !watchedDate}
          onClick={handleAdd}
          style={{ minHeight: 44, minWidth: 44 }}
          type="button"
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
