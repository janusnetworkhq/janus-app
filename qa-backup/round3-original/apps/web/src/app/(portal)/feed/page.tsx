import type { Metadata } from "next";
import { FeedTimeline } from "@/components/feed-timeline";
import { PageHeader } from "@/components/ui/feedback";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { nestGet } from "@/lib/api";
import type { FeedPage } from "@/lib/types";

export const metadata: Metadata = { title: "Feed" };

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ university?: string }>;
}) {
  const { university } = await searchParams;
  const initial = await nestGet<FeedPage>(
    `/v1/feed?limit=8${university ? `&university=${encodeURIComponent(university)}` : ""}`,
  );

  return (
    <div>
      <PageHeader
        kicker="Discover"
        title="Talent feed"
        description="Public 9:16 HLS. Vault files stay locked until an NDA is signed."
        actions={
          <form className="flex gap-2" action="/feed">
            <Input name="university" placeholder="Filter university" defaultValue={university} className="w-48" />
            <Button type="submit" variant="secondary">
              Filter
            </Button>
          </form>
        }
      />
      <FeedTimeline key={university ?? "all"} initial={initial} university={university} />
    </div>
  );
}
