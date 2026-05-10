import type { Metadata } from "next";
import { MovieSearch } from "@/components/search/movie-search";
import { SettingsSheet } from "@/components/settings/settings-sheet";

export const metadata: Metadata = {
  title: "Search",
};

export default function SearchPage() {
  return (
    <main className="space-y-6">
      <section className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-[32px] font-bold leading-[1.1]">Search</h1>
          <SettingsSheet />
        </div>
      </section>

      <MovieSearch />
    </main>
  );
}
