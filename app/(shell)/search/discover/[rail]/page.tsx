import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BackButton } from "@/components/navigation/back-button";
import { DiscoverGrid } from "@/components/search/discover-grid";
import { PageHeader } from "@/components/ui/section";
import { DISCOVER_RAIL_LABELS, parseDiscoverRail } from "@/lib/media/discover-rails";

type DiscoverRailPageProps = {
  params: Promise<{ rail: string }>;
};

export async function generateMetadata({ params }: DiscoverRailPageProps): Promise<Metadata> {
  const rail = parseDiscoverRail((await params).rail);

  return { title: rail ? DISCOVER_RAIL_LABELS[rail] : "Discover" };
}

export default async function DiscoverRailPage({ params }: DiscoverRailPageProps) {
  const rail = parseDiscoverRail((await params).rail);

  if (!rail) {
    notFound();
  }

  return (
    <main className="space-y-4">
      <PageHeader leading={<BackButton fallbackHref="/search" />} title={DISCOVER_RAIL_LABELS[rail]} />
      <DiscoverGrid rail={rail} />
    </main>
  );
}
