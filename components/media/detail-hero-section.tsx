import Image from "next/image";
import { Film } from "lucide-react";

import { BackButton } from "@/components/navigation/back-button";
import { SettingsSheet } from "@/components/settings/settings-sheet";
import { tmdbImage } from "@/lib/providers/tmdb/images";

type DetailHeroSectionProps = {
  backdropPath?: string | null;
};

export function DetailHeroSection({ backdropPath }: DetailHeroSectionProps) {
  return (
    <section className="-mx-4">
      <div className="relative h-[244px] overflow-hidden bg-surface-muted">
        {backdropPath ? (
          <Image
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover"
            priority
            {...tmdbImage(backdropPath, "heroBackdrop")}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-surface-muted">
            <Film aria-hidden="true" className="h-10 w-10 text-text-faint" strokeWidth={1.6} />
          </div>
        )}
        <div className="movie-detail-hero-scrim absolute inset-0" />
        <div className="movie-detail-title-vignette absolute inset-0" />
        <div
          className="absolute left-4 right-4 top-0 flex items-center justify-between"
          style={{ paddingTop: "calc(1.25rem + env(safe-area-inset-top))" }}
        >
          <BackButton className="-ml-1 flex h-11 items-center gap-0.5 text-white drop-shadow-sm" />
          <SettingsSheet />
        </div>
      </div>
    </section>
  );
}
