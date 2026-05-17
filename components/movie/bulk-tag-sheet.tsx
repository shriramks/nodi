"use client";

import { useState, useTransition, type FormEvent } from "react";
import { LoaderCircle, Plus, X } from "lucide-react";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import {
  bulkAddTagAction,
  bulkAttachTagByIdAction,
  bulkDetachTagAction,
} from "@/app/(shell)/movie/bulk-actions";

type Tag = { id: string; name: string };

type Props = {
  movieIds: string[];
  allTags: Tag[];
  onClose: () => void;
  onDone: () => void;
};

export function BulkTagSheet({ movieIds, allTags, onClose, onDone }: Props) {
  const [newTagName, setNewTagName] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"add" | "remove">("add");
  const [pendingAction, setPendingAction] = useState<
    { kind: "attach" | "detach"; tagId: string } | { kind: "create" } | null
  >(null);

  function handleAttach(tagId: string) {
    setError(null);
    setPendingAction({ kind: "attach", tagId });
    startTransition(async () => {
      try {
        await bulkAttachTagByIdAction(movieIds, tagId);
        onDone();
      } catch {
        setError("Tag could not be added. Try again.");
      } finally {
        setPendingAction(null);
      }
    });
  }

  function handleDetach(tagId: string) {
    setError(null);
    setPendingAction({ kind: "detach", tagId });
    startTransition(async () => {
      try {
        await bulkDetachTagAction(movieIds, tagId);
        onDone();
      } catch {
        setError("Tag could not be removed. Try again.");
      } finally {
        setPendingAction(null);
      }
    });
  }

  function handleCreateNew(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = newTagName.replace(/\s+/g, " ").trim();
    if (!name) return;
    setError(null);
    setPendingAction({ kind: "create" });
    startTransition(async () => {
      try {
        await bulkAddTagAction(movieIds, name);
        setNewTagName("");
        onDone();
      } catch {
        setError("Tag could not be saved. Try again.");
      } finally {
        setPendingAction(null);
      }
    });
  }

  return (
    <BottomSheet ariaLabel="Manage Tags" dismissButtonLabel="Close tags" onClose={onClose}>
      <p className="mb-1 text-[17px] font-semibold text-foreground">Tags</p>
      <p className="mb-4 text-[13px] text-text-2">
        {movieIds.length} {movieIds.length === 1 ? "movie" : "movies"} selected
      </p>

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("add")}
          className={[
            "h-8 rounded-full px-4 text-[13px] font-medium",
            activeTab === "add"
              ? "bg-accent/15 text-accent"
              : "border border-border text-text-2",
          ].join(" ")}
        >
          Add tag
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("remove")}
          className={[
            "h-8 rounded-full px-4 text-[13px] font-medium",
            activeTab === "remove"
              ? "bg-accent/15 text-accent"
              : "border border-border text-text-2",
          ].join(" ")}
        >
          Remove tag
        </button>
      </div>

      {activeTab === "add" && (
        <div className="max-h-64 overflow-y-auto">
          {allTags.length > 0 && (
            <div className="mb-2">
              {allTags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => handleAttach(tag.id)}
                  disabled={isPending}
                  className="flex w-full items-center gap-3 border-b border-divider py-3 text-left last:border-b-0 active:opacity-70 disabled:opacity-50"
                >
                  {pendingAction?.kind === "attach" && pendingAction.tagId === tag.id ? (
                    <LoaderCircle
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 animate-spin text-accent"
                      strokeWidth={2.2}
                    />
                  ) : (
                    <Plus aria-hidden="true" className="h-4 w-4 shrink-0 text-accent" strokeWidth={2} />
                  )}
                  <span className="flex-1 text-[15px] text-foreground">{tag.name}</span>
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleCreateNew} className="mt-2 flex items-center gap-2 border-t border-divider pt-3">
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="New tag name…"
              className="h-10 flex-1 rounded-xl border border-border bg-surface-muted px-3 text-[15px] text-foreground placeholder:text-text-faint"
            />
            <button
              type="submit"
              disabled={isPending || !newTagName.trim()}
              className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-[15px] font-semibold text-white disabled:opacity-40 active:opacity-70"
            >
              {pendingAction?.kind === "create" ? (
                <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" strokeWidth={2.2} />
              ) : null}
              Create
            </button>
          </form>
        </div>
      )}

      {activeTab === "remove" && (
        <div className="max-h-64 overflow-y-auto">
          {allTags.length === 0 ? (
            <p className="py-4 text-[15px] text-text-2">No tags to remove.</p>
          ) : (
            allTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => handleDetach(tag.id)}
                disabled={isPending}
                className="flex w-full items-center gap-3 border-b border-divider py-3 text-left last:border-b-0 active:opacity-70 disabled:opacity-50"
              >
                {pendingAction?.kind === "detach" && pendingAction.tagId === tag.id ? (
                  <LoaderCircle
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 animate-spin text-unsynced"
                    strokeWidth={2.2}
                  />
                ) : (
                  <X aria-hidden="true" className="h-4 w-4 shrink-0 text-unsynced" strokeWidth={2} />
                )}
                <span className="flex-1 text-[15px] text-foreground">{tag.name}</span>
              </button>
            ))
          )}
        </div>
      )}

      {error && <p className="mt-2 text-[13px] text-unsynced">{error}</p>}
    </BottomSheet>
  );
}
