import Image from "next/image";
import Link from "next/link";
import { Film } from "lucide-react";

import { tmdbImage } from "@/lib/providers/tmdb/images";

interface CastMemberCardProps {
  characterName?: string | null;
  name: string;
  personHref?: string;
  profilePath?: string | null;
}

export function CastMemberCard({ characterName, name, personHref, profilePath }: CastMemberCardProps) {
  const content = (
    <>
      <div
        aria-hidden="true"
        className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-full bg-surface-muted"
      >
        {profilePath ? (
          <Image
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover object-[center_28%]"
            {...tmdbImage(profilePath, "profileAvatar")}
          />
        ) : (
          <Film aria-hidden="true" className="h-5 w-5 text-text-faint" strokeWidth={1.7} />
        )}
      </div>
      <p className="mt-1.5 truncate text-center text-[12px] font-semibold leading-[1.2] text-foreground">
        {name}
      </p>
      {characterName ? (
        <p className="mt-0.5 truncate text-center text-[11px] text-text-muted">{characterName}</p>
      ) : null}
    </>
  );

  if (!personHref) {
    return <article className="w-16 shrink-0">{content}</article>;
  }

  return (
    <Link className="w-16 shrink-0 active:opacity-70" href={personHref}>
      {content}
    </Link>
  );
}
