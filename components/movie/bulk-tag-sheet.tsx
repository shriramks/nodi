"use client";

import { useState, useTransition, type FormEvent } from "react";
import { X, Plus } from "lucide-react";

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

  function handleAttach(tagId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await bulkAttachTagByIdAction(movieIds, tagId);
        onDone();
      } catch {
        setError("Tag could not be added. Try again.");
      }
    });
  }

  function handleDetach(tagId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await bulkDetachTagAction(movieIds, tagId);
        onDone();
      } catch {
        setError("Tag could not be removed. Try again.");
      }
    });
  }

  function handleCreateNew(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = newTagName.replace(/\s+/g, " ").trim();
    if (!name) return;
    setError(null);
    startTransition(async () => {
      try {
        await bulkAddTagAction(movieIds, name);
        setNewTagName("");
        onDone();
      } catch {
        setError("Tag could not be saved. Try again.");
      }
    });
  }

  return (
    <>
      <div
        aria-hidden="true"
        className="fixed inset-0 z-40 bg-black/60"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Manage Tags"
        className="fixed inset-x-0 bottom-0 z-[60] rounded-t-3xl bg-surface px-5 pt-3"
        style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto mb-5 mt-2 h-1 w-9 rounded-full bg-surface-muted" />

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
                    <Plus aria-hidden="true" className="h-4 w-4 shrink-0 text-accent" strokeWidth={2} />
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
                className="h-10 shrink-0 rounded-xl bg-accent px-4 text-[15px] font-semibold text-white disabled:opacity-40 active:opacity-70"
              >
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
                  <X aria-hidden="true" className="h-4 w-4 shrink-0 text-unsynced" strokeWidth={2} />
                  <span className="flex-1 text-[15px] text-foreground">{tag.name}</span>
                </button>
              ))
            )}
          </div>
        )}

        {error && <p className="mt-2 text-[13px] text-unsynced">{error}</p>}
      </div>
    </>
  );
}
