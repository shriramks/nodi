import type { Metadata } from "next";
import { MovieSearch } from "@/components/search/movie-search";

export const metadata: Metadata = {
  title: "Search",
};

export default function SearchPage() {
  return (
    <main className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-[32px] font-bold leading-[1.1]">Search</h1>
      </section>

      <MovieSearch />
    </main>
  );
}
