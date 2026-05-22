"use client";

import { useState } from "react";

type OverviewTextProps = {
  formatExpandedText?: boolean;
  text: string | null;
};

export function OverviewText({ formatExpandedText = false, text }: OverviewTextProps) {
  const [expanded, setExpanded] = useState(false);

  if (!text) {
    return (
      <p className="text-[15px] leading-[1.4] text-text-muted">
        No overview available.
      </p>
    );
  }

  const isLong = text.length > 200;
  const shouldFormatExpandedText = formatExpandedText && expanded;
  const paragraphs = shouldFormatExpandedText ? toReadableParagraphs(text) : [text];

  return (
    <div className="space-y-2">
      {shouldFormatExpandedText ? (
        <div className="space-y-3">
          {paragraphs.map((paragraph, index) => (
            <p
              key={`${index}-${paragraph.slice(0, 24)}`}
              className="text-[15px] leading-[1.65] text-text-2"
            >
              {paragraph}
            </p>
          ))}
        </div>
      ) : (
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
      )}
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

function toReadableParagraphs(text: string) {
  const existingParagraphs = text
    .split(/\n+/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (existingParagraphs.length > 1) {
    return existingParagraphs;
  }

  const sentences = text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+(?=["'A-Z0-9])/)
    .filter(Boolean);

  if (sentences.length < 4) {
    return [text];
  }

  const paragraphs: string[] = [];
  let current: string[] = [];
  let currentLength = 0;

  for (const sentence of sentences) {
    const nextLength = currentLength + sentence.length;

    if (current.length >= 3 || (current.length > 0 && nextLength > 460)) {
      paragraphs.push(current.join(" "));
      current = [];
      currentLength = 0;
    }

    current.push(sentence);
    currentLength += sentence.length;
  }

  if (current.length > 0) {
    paragraphs.push(current.join(" "));
  }

  return paragraphs;
}
