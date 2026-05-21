import type { Metadata } from "next";
import { MovieSearch } from "@/components/search/movie-search";
import { SettingsSheet } from "@/components/settings/settings-sheet";
import { PageHeader } from "@/components/ui/section";

export const metadata: Metadata = {
  title: "Search",
};

export default function SearchPage() {
  return (
    <main className="space-y-6">
      <PageHeader title="Search" action={<SettingsSheet />} />

      <MovieSearch />
    </main>
  );
}
