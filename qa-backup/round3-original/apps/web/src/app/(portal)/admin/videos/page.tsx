import type { Metadata } from "next";
import Link from "next/link";
import { nestGet } from "@/lib/api";
import type { AdminVideo } from "@/lib/types";
import { formatWhen } from "@/lib/utils";
import { Badge, EmptyState, PageHeader } from "@/components/ui/feedback";
import { Table, Td, Th } from "@/components/ui/table";
import { VideoModerationButtons } from "@/components/admin-actions";
import { AdminsOnly } from "@/components/admins-only";
import { getAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Moderate videos" };

export default async function AdminVideosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const admin = await getAdmin();
  if (!admin) return <AdminsOnly />;
  const { status } = await searchParams;
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  const videos = await nestGet<AdminVideo[]>(`/v1/admin/videos${qs}`);

  return (
    <div>
      <PageHeader
        kicker="Moderation"
        title="Videos"
        description="Hide removes a clip from the public feed. Restore puts READY videos back."
        actions={
          <div className="flex gap-2 text-sm">
            <Link href="/admin/videos" className={!status ? "text-primary" : "text-muted-foreground"}>
              All
            </Link>
            <Link href="/admin/videos?status=READY" className={status === "READY" ? "text-primary" : "text-muted-foreground"}>
              Ready
            </Link>
            <Link href="/admin/videos?status=HIDDEN" className={status === "HIDDEN" ? "text-primary" : "text-muted-foreground"}>
              Hidden
            </Link>
          </div>
        }
      />
      {videos.length === 0 ? (
        <EmptyState title="No videos" body="Nothing matches this filter." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Caption</Th>
              <Th>Author</Th>
              <Th>Status</Th>
              <Th>Likes</Th>
              <Th>Created</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {videos.map((video) => (
              <tr key={video.id}>
                <Td className="max-w-xs truncate">{video.caption || "—"}</Td>
                <Td>
                  {video.author ? (
                    <Link href={`/talent/${video.authorId}`} className="hover:text-primary">
                      @{video.author.handle}
                    </Link>
                  ) : (
                    video.authorId.slice(0, 8)
                  )}
                </Td>
                <Td>
                  <Badge tone={video.status === "HIDDEN" ? "danger" : "muted"}>{video.status}</Badge>
                </Td>
                <Td>{video.likeCount}</Td>
                <Td className="text-muted-foreground">{formatWhen(video.createdAt)}</Td>
                <Td>
                  <VideoModerationButtons id={video.id} status={video.status} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
