import { redirect } from "next/navigation";

import { queryHref, type LibrarySearchParams } from "../library/library-route";

export default async function MediaRedirectPage({
  searchParams,
}: {
  searchParams: Promise<LibrarySearchParams>;
}) {
  redirect(queryHref("/library", await searchParams, {}));
}
