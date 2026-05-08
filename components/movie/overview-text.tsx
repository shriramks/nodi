"use client";

import { useState } from "react";

export function OverviewText({ text }: { text: string | null }) {
  const [expanded, setExpanded] = useState(false);

  if (!text) {
    return (
      <p className="text-[15px] leading-[1.4] text-text-muted">
        No overview available.
      </p>
    );
  }

  const isLong = text.length > 200;

  return (
    <div className="space-y-2">
      <p
        className={[
          "text-[15px] leading-[1.6] text-text-2",
          !expanded && isLong ? "line-clamp-3" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {text}
      </p>
      {isLong && (
        <button
          className="text-[13px] font-semibold text-accent"
          onClick={() => setExpanded(!expanded)}
          type="button"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
