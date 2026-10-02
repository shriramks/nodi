import { redirect } from "next/navigation";

import { queryHref, type LibrarySearchParams } from "../library/library-route";

export default async function StatsRedirectPage({
  searchParams,
}: {
  searchParams: Promise<LibrarySearchParams>;
}) {
  const params = await searchParams;
  redirect(queryHref("/insights", { type: params.type }, {}));
}
