"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useRef, useState, useTransition } from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  Ellipsis,
  History,
  LoaderCircle,
  Pencil,
  RefreshCw,
  Trash2,
  Tv,
  X,
} from "lucide-react";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { SectionHeader } from "@/components/ui/section";
import {
  addEpisodeWatchDateAction,
  deleteEpisodeWatchActivityAction,
  markSeasonWatchedAction,
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

export function EpisodeHeaderControls({
  activity,
  episodeId,
  showId,
}: {
  activity: WatchActivity[];
  episodeId: string;
  showId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const isWatched = activity.length > 0;
  const today = todayDateValue();

  function run(task: () => Promise<unknown>, failure: string) {
    setError(null);
    startTransition(async () => {
      try {
        await task();
      } catch {
        setError(failure);
      }
    });
  }

  function toggle() {
    run(
      () => toggleEpisodeWatchedAction(showId, episodeId, !isWatched),
      "Episode state was not saved. Try again.",
    );
  }

  function logRewatch(date: string) {
    if (!date) return;
    run(
      () => addEpisodeWatchDateAction(showId, episodeId, date),
      "Watch date was not saved. Try again.",
    );
  }

  function pickDate() {
    setMenuOpen(false);
    const input = dateInputRef.current;
    if (!input) return;
    input.value = today;
    if (typeof input.showPicker === "function") {
      input.showPicker();
    } else {
      input.click();
    }
  }

  const itemClass =
    "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[15px] text-foreground active:bg-surface-muted disabled:opacity-50";

  return (
    <div className="relative flex items-center gap-2">
      <button
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-label="More actions"
        className="grid h-11 w-11 place-items-center rounded-full bg-surface text-foreground active:opacity-70"
        onClick={() => setMenuOpen((value) => !value)}
        type="button"
      >
        <Ellipsis aria-hidden="true" className="h-5 w-5" strokeWidth={2.4} />
      </button>

      <button
        aria-label={isWatched ? "Mark episode unwatched" : "Mark episode watched"}
        className={[
          "grid h-11 w-11 place-items-center rounded-full active:opacity-70 disabled:opacity-50",
          isWatched ? "bg-accent text-black" : "bg-surface text-text-muted",
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

      {/* Hidden native picker, opened from the "Watched again on" menu row. */}
      <input
        aria-label="Rewatch date"
        className="pointer-events-none absolute right-0 top-full h-0 w-0 opacity-0"
        max={today}
        onChange={(event) => logRewatch(event.target.value)}
        ref={dateInputRef}
        tabIndex={-1}
        type="date"
      />

      {menuOpen ? (
        <>
          {/* Portaled: the blurred header is a containing block for fixed children. */}
          {createPortal(
            <button
              aria-label="Close menu"
              className="fixed inset-0 z-10 cursor-default"
              onClick={() => setMenuOpen(false)}
              type="button"
            />,
            document.body,
          )}
          <div
            className="absolute right-0 top-[calc(100%+8px)] z-40 w-[252px] rounded-2xl border border-divider bg-surface p-1.5 shadow-xl"
            role="menu"
          >
            {isWatched ? (
              <>
                <button
                  className={itemClass}
                  onClick={() => {
                    setMenuOpen(false);
                    logRewatch(today);
                  }}
                  role="menuitem"
                  type="button"
                >
                  <RefreshCw aria-hidden="true" className="h-[18px] w-[18px] text-text-2" strokeWidth={2} />
                  Watched again today
                </button>
                <button className={itemClass} onClick={pickDate} role="menuitem" type="button">
                  <CalendarDays aria-hidden="true" className="h-[18px] w-[18px] text-text-2" strokeWidth={2} />
                  Watched again on…
                </button>
                <button
                  className={itemClass}
                  onClick={() => {
                    setMenuOpen(false);
                    setHistoryOpen(true);
                  }}
                  role="menuitem"
                  type="button"
                >
                  <History aria-hidden="true" className="h-[18px] w-[18px] text-text-2" strokeWidth={2} />
                  Watch history
                  <span className="ml-auto text-[13px] text-text-muted">
                    {activity.length} {activity.length === 1 ? "watch" : "watches"}
                  </span>
                </button>
                <div className="mx-2 my-1 h-px bg-divider" />
              </>
            ) : null}
            <Link className={itemClass} href={`/show/${showId}`} role="menuitem">
              <Tv aria-hidden="true" className="h-[18px] w-[18px] text-text-2" strokeWidth={2} />
              Go to show
            </Link>
          </div>
        </>
      ) : null}

      <EpisodeWatchHistoryEditor
        activity={activity}
        episodeId={episodeId}
        onOpenChange={setHistoryOpen}
        open={historyOpen}
        showId={showId}
      />

      {error ? (
        <p className="absolute right-0 top-full mt-2 whitespace-nowrap text-[13px] text-unsynced">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function EpisodeWatchHistoryEditor({
  activity,
  episodeId,
  onOpenChange,
  open,
  showId,
}: {
  activity: WatchActivity[];
  episodeId: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  showId: string;
}) {
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
    onOpenChange(false);
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
