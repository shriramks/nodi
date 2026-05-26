"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type PendingAction = "library" | "wishlist";

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
  saveToLibrary,
  status,
}: {
  addToWishlist: () => Promise<void>;
  saveToLibrary: () => Promise<void>;
  status: "watching" | "watched" | "wishlist" | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  function run(pendingKey: PendingAction, action: () => Promise<void>) {
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

  if (status === "watching" || status === "watched") {
    return null;
  }

  if (status === "wishlist") {
    return (
      <div className="space-y-2">
        <button
          className="flex h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-accent/15 px-4 text-[15px] font-semibold text-accent active:opacity-70 disabled:opacity-50"
          disabled={isPending}
          onClick={() => run("library", saveToLibrary)}
          type="button"
        >
          {pendingAction === "library" ? (
            <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" strokeWidth={2.2} />
          ) : null}
          Add to Library
        </button>
        {error ? <p className="text-[13px] text-unsynced">{error}</p> : null}
      </div>
    );
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
