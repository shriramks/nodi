"use client";

import { type FormEvent, useState, useTransition } from "react";
import { Check, ChevronDown, Heart, LoaderCircle, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { CollapsibleSection, SectionScrollBleed } from "@/components/ui/section";
import {
  addShowTagAction,
  attachShowTagByIdAction,
  removeShowTagAction,
  updateShowRatingAction,
} from "@/app/(shell)/show/actions";

type PendingAction = "library" | "wishlist";
type LocalPendingAction = PendingAction | "watched" | "remove";
type ShowStatus = "watching" | "watched" | "wishlist" | null;
type ShowTag = {
  id: string;
  name: string;
};

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

export function RemoteShowStateActions({
  addToWishlist,
  saveToLibrary,
}: {
  addToWishlist: () => Promise<string>;
  saveToLibrary: () => Promise<string>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  function run(pendingKey: PendingAction, action: () => Promise<string>) {
    setError(null);
    setPendingAction(pendingKey);
    startTransition(async () => {
      try {
        const detailUrl = await action();
        router.push(detailUrl);
      } catch {
        setError("Something went wrong. Try again.");
      } finally {
        setPendingAction(null);
      }
    });
  }

  return (
    <ShowActionButtons
      error={error}
      isPending={isPending}
      onAddToWishlist={() => run("wishlist", addToWishlist)}
      onSaveToLibrary={() => run("library", saveToLibrary)}
      pendingAction={pendingAction}
    />
  );
}

export function LocalShowStateActions({
  addToWishlist,
  isWatched,
  markWatched,
  removeFromLibrary,
  saveToLibrary,
  status,
}: {
  addToWishlist: () => Promise<void>;
  isWatched?: boolean;
  markWatched: () => Promise<void>;
  removeFromLibrary: () => Promise<void>;
  saveToLibrary: () => Promise<void>;
  status: ShowStatus;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<LocalPendingAction | null>(null);

  function run(pendingKey: LocalPendingAction, action: () => Promise<void>) {
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

  const currentStatus = isWatched ? "watched" : status;
  const primaryActions = [
    currentStatus !== "watching" && currentStatus !== "watched"
      ? {
          key: "library" as const,
          label: currentStatus === "wishlist" ? "Add to Library" : "Watching",
          onClick: () => run("library", saveToLibrary),
          style: "primary" as const,
        }
      : null,
    currentStatus !== "watched"
      ? {
          key: "watched" as const,
          label: "Mark Watched",
          onClick: () => run("watched", markWatched),
          style: currentStatus === null ? "primary" as const : "secondary" as const,
        }
      : null,
  ].filter((action): action is NonNullable<typeof action> => action !== null);

  const secondaryActions = [
    currentStatus === null
      ? {
          key: "wishlist" as const,
          label: "+ Wishlist",
          onClick: () => run("wishlist", addToWishlist),
          tone: "default" as const,
        }
      : null,
    currentStatus !== null
      ? {
          key: "remove" as const,
          label: "Remove",
          onClick: () => run("remove", removeFromLibrary),
          tone: "danger" as const,
        }
      : null,
  ].filter((action): action is NonNullable<typeof action> => action !== null);

  return (
    <div className="space-y-2">
      {primaryActions.length > 0 ? (
        <div className="flex gap-3">
          {primaryActions.map((action) => (
            <button
              className={[
                "flex h-[50px] flex-1 items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-semibold active:opacity-70 disabled:opacity-50",
                action.style === "primary"
                  ? "bg-accent/15 text-accent"
                  : "border border-border text-text-2",
              ].join(" ")}
              disabled={isPending}
              key={action.key}
              onClick={action.onClick}
              type="button"
            >
              {pendingAction === action.key ? (
                <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" strokeWidth={2.2} />
              ) : null}
              {action.label}
            </button>
          ))}
        </div>
      ) : null}

      {secondaryActions.length > 0 ? (
        <div className="flex gap-3">
          {secondaryActions.map((action) => (
            <button
              className={[
                "flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border px-4 text-[14px] font-semibold active:opacity-70 disabled:opacity-50",
                action.tone === "danger" ? "text-unsynced" : "text-text-2",
              ].join(" ")}
              disabled={isPending}
              key={action.key}
              onClick={action.onClick}
              type="button"
            >
              {pendingAction === action.key ? (
                <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" strokeWidth={2.2} />
              ) : null}
              {action.label}
            </button>
          ))}
        </div>
      ) : null}

      {error ? <p className="text-[13px] text-unsynced">{error}</p> : null}
    </div>
  );
}

export function ShowRatingSheet({
  currentRating,
  showId,
}: {
  currentRating: number | null;
  showId: string;
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
        await updateShowRatingAction(showId, n);
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
        aria-label={currentRating !== null ? `Rating: ${currentRating}. Tap to change` : "Tap to rate"}
        className={[
          "flex items-center gap-1.5 text-[15px] active:opacity-70",
          currentRating !== null ? "text-accent" : "text-foreground",
        ].join(" ")}
        onClick={() => setOpen(true)}
        style={{ minHeight: 44 }}
        type="button"
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

      {open ? (
        <BottomSheet ariaLabel="Your Rating" onClose={() => setOpen(false)}>
          <p className="mb-2 text-[17px] font-semibold text-foreground">Your Rating</p>

          <div>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                className="flex w-full items-center gap-3 border-b border-divider py-3 text-left last:border-b-0 active:opacity-70 disabled:opacity-50"
                disabled={isPending}
                key={n}
                onClick={() => handleRate(n)}
                type="button"
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

          {currentRating !== null ? (
            <button
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border text-[15px] font-semibold text-text-2 active:opacity-70 disabled:opacity-50"
              disabled={isPending}
              onClick={() => handleRate(null)}
              type="button"
            >
              {pendingRating === "clear" ? (
                <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" strokeWidth={2.2} />
              ) : null}
              Clear rating
            </button>
          ) : null}

          {error ? <p className="mt-2 text-[13px] text-unsynced">{error}</p> : null}
        </BottomSheet>
      ) : null}
    </>
  );
}

export function ShowTagEditor({
  allTags,
  showId,
  tags,
}: {
  allTags: ShowTag[];
  showId: string;
  tags: ShowTag[];
}) {
  const [newTagName, setNewTagName] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const showTagIds = new Set(tags.map((tag) => tag.id));
  const searchTerm = newTagName.toLowerCase().trim();
  const suggestions =
    searchTerm.length > 0
      ? allTags.filter((tag) => !showTagIds.has(tag.id) && tag.name.toLowerCase().includes(searchTerm))
      : [];

  function handleAttach(tagId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await attachShowTagByIdAction(showId, tagId);
      } catch {
        setError("Tag could not be added. Try again.");
      }
    });
  }

  function handleRemove(tagId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await removeShowTagAction(showId, tagId);
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
        await addShowTagAction(showId, name);
        setNewTagName("");
      } catch {
        setError("Tag could not be saved. Try again.");
      } finally {
        setIsCreatingTag(false);
      }
    });
  }

  return (
    <CollapsibleSection title="Tags">
      <div>
        {tags.length > 0 ? (
          <SectionScrollBleed className="flex gap-2 pb-3 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tags.map((tag) => (
              <button
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-accent/12 px-2.5 text-[13px] font-medium text-accent active:opacity-70 disabled:opacity-50"
                disabled={isPending}
                key={tag.id}
                onClick={() => handleRemove(tag.id)}
                type="button"
              >
                <span>{tag.name}</span>
                <X aria-hidden="true" className="h-3 w-3 opacity-60" strokeWidth={2.5} />
              </button>
            ))}
          </SectionScrollBleed>
        ) : null}

        {suggestions.length > 0 ? (
          <SectionScrollBleed className="flex gap-2 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {suggestions.map((tag) => (
              <button
                className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 text-[13px] text-text-2 active:opacity-70 disabled:opacity-50"
                disabled={isPending}
                key={tag.id}
                onClick={() => handleAttach(tag.id)}
                type="button"
              >
                <Plus aria-hidden="true" className="h-3 w-3 opacity-50" strokeWidth={2.5} />
                <span>{tag.name}</span>
              </button>
            ))}
          </SectionScrollBleed>
        ) : null}

        <form className="flex items-center gap-1 border-t border-divider py-2" onSubmit={handleCreateNew}>
          <input
            aria-label="New tag name"
            className="min-w-0 flex-1 bg-transparent py-2 text-[15px] text-foreground outline-none placeholder:text-text-muted"
            maxLength={80}
            onChange={(event) => setNewTagName(event.target.value)}
            placeholder="New tag..."
            value={newTagName}
          />
          <button
            aria-label="Add tag"
            className="flex shrink-0 items-center justify-end gap-1.5 text-[15px] font-semibold text-accent disabled:opacity-40 active:opacity-60"
            disabled={isPending || newTagName.trim().length === 0}
            style={{ minHeight: 44, minWidth: 44 }}
            type="submit"
          >
            {isCreatingTag ? (
              <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" strokeWidth={2.2} />
            ) : null}
            Add
          </button>
        </form>

        {error ? <p className="pt-1 text-[13px] text-unsynced">{error}</p> : null}
      </div>
    </CollapsibleSection>
  );
}

function ShowActionButtons({
  error,
  isPending,
  onAddToWishlist,
  onSaveToLibrary,
  pendingAction,
}: {
  error: string | null;
  isPending: boolean;
  onAddToWishlist: () => void;
  onSaveToLibrary: () => void;
  pendingAction: PendingAction | null;
}) {
  return (
    <div className="space-y-2">
      <div className="flex gap-3">
        <button
          className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-xl bg-accent/15 px-4 text-[15px] font-semibold text-accent active:opacity-70 disabled:opacity-50"
          disabled={isPending}
          onClick={onSaveToLibrary}
          type="button"
        >
          {pendingAction === "library" ? (
            <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" strokeWidth={2.2} />
          ) : null}
          Add to Library
        </button>

        <button
          className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-xl border border-border px-4 text-[15px] font-semibold text-text-2 active:opacity-70 disabled:opacity-50"
          disabled={isPending}
          onClick={onAddToWishlist}
          type="button"
        >
          {pendingAction === "wishlist" ? (
            <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" strokeWidth={2.2} />
          ) : null}
          + Wishlist
        </button>
      </div>

      {error ? <p className="text-[13px] text-unsynced">{error}</p> : null}
    </div>
  );
}
