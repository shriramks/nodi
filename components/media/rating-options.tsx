"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";

import { getRatingReferencesAction } from "@/app/(shell)/rating-actions";
import {
  RATING_LABELS,
  RATING_REFERENCE_WORDS,
  SELECTABLE_RATINGS,
} from "@/lib/media/rating-scale";

type Props = {
  // undefined = nothing preselected (bulk), null = currently unrated.
  currentRating: number | null | undefined;
  disabled: boolean;
  // Titles being rated; never offered as their own reference.
  excludeIds: string[];
  onCancel: () => void;
  onSelect: (rating: number | null) => void;
  pendingRating: number | "clear" | null;
  title: string;
};

export function RatingOptions({
  currentRating,
  disabled,
  excludeIds,
  onCancel,
  onSelect,
  pendingRating,
  title,
}: Props) {
  const [references, setReferences] = useState<Record<number, string>>({});
  const excludeKey = excludeIds.join(",");

  useEffect(() => {
    let active = true;
    getRatingReferencesAction(excludeKey ? excludeKey.split(",") : [])
      .then((picks) => {
        if (active) setReferences(picks);
      })
      .catch(() => {
        // References are decoration; the sheet works without them.
      });
    return () => {
      active = false;
    };
  }, [excludeKey]);

  return (
    <div role="radiogroup" aria-label={title}>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[17px] font-semibold text-foreground">{title}</p>
        <button
          type="button"
          onClick={onCancel}
          className="flex min-h-11 items-center px-1 text-[15px] font-semibold text-accent active:opacity-70"
        >
          Cancel
        </button>
      </div>

      <Option
        checked={currentRating === null}
        disabled={disabled}
        onClick={() => onSelect(null)}
        pending={pendingRating === "clear"}
      >
        <span className="text-[17px] text-foreground">Not rated</span>
      </Option>

      {SELECTABLE_RATINGS.map((n) => (
        <Option
          key={n}
          checked={currentRating === n}
          disabled={disabled}
          onClick={() => onSelect(n)}
          pending={pendingRating === n}
        >
          <span className="tabnum w-5 shrink-0 text-[17px] font-bold text-foreground">{n}</span>
          <span className={["shrink-0 text-[17px] text-foreground", currentRating === n ? "font-bold" : ""].join(" ")}>
            {RATING_LABELS[n]}
          </span>
          {references[n] ? (
            <span className="ml-auto min-w-0 truncate pl-2 text-[14px] italic text-text-muted">
              {references[n]} {RATING_REFERENCE_WORDS[n]}
            </span>
          ) : null}
        </Option>
      ))}
    </div>
  );
}

function Option({
  checked,
  children,
  disabled,
  onClick,
  pending,
}: {
  checked: boolean;
  children: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
  pending: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-[52px] w-full items-center gap-3 text-left active:opacity-70 disabled:opacity-50"
    >
      <span
        aria-hidden="true"
        className={[
          "flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border-2",
          checked ? "border-accent" : "border-border",
        ].join(" ")}
      >
        {pending ? (
          <LoaderCircle className="h-3.5 w-3.5 animate-spin text-accent" strokeWidth={2.4} />
        ) : checked ? (
          <span className="h-3 w-3 rounded-full bg-accent" />
        ) : null}
      </span>
      {children}
    </button>
  );
}
