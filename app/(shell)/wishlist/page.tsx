import type { Metadata } from "next";

import { LibraryGrid } from "@/components/library/library-grid";
import { SettingsSheet } from "@/components/settings/settings-sheet";
import { PageHeader } from "@/components/ui/section";
import { listMediaLibraryMoviesPage } from "@/lib/db/queries";
import {
  firstParam,
  parseLibraryType,
  type LibrarySearchParams,
} from "../library/library-route";

export const metadata: Metadata = {
  title: "Wishlist",
};

export default async function WishlistPage({
  searchParams,
}: {
  searchParams: Promise<LibrarySearchParams>;
}) {
  const params = await searchParams;
  const type = parseLibraryType(firstParam(params.type));
  const queuePage = await listMediaLibraryMoviesPage({
    status: "to_watch",
    type,
  });

  return (
    <main className="space-y-4">
      <PageHeader
        title="Wishlist"
        action={<SettingsSheet />}
        subtitle={(
          <>
            <span className="tabnum">{queuePage.totalCount}</span> queued
            {type !== "all" && <> · {type === "movie" ? "Movies" : "Shows"}</>}
          </>
        )}
      />

      {queuePage.movies.length > 0 ? (
        <LibraryGrid
          key={type}
          initialPage={queuePage}
          pageStatus="to_watch"
          libraryType={type}
        />
      ) : (
        <section className="rounded-2xl border border-dashed border-border bg-surface p-4 text-[15px] leading-[1.4] text-text-2">
          No queued titles yet. Search for a title to add it to your wishlist.
        </section>
      )}
    </main>
  );
}
