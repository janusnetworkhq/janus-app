import type { Metadata } from "next";
import Link from "next/link";
import { nestPost } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import type { Playback } from "@/lib/types";
import { cn, formatWhen } from "@/lib/utils";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { RequestNdaButton } from "@/components/request-nda-button";
import { VaultViewer } from "@/components/vault-viewer";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Vault file" };

export default async function VaultAssetPage({
  params,
}: {
  params: Promise<{ studentId: string; assetId: string }>;
}) {
  const { studentId, assetId } = await params;
  let playback: Playback | null = null;
  let denied: ApiError | null = null;
  try {
    playback = await nestPost<Playback>(`/v1/vault/assets/${assetId}/playback`);
  } catch (error) {
    if (error instanceof ApiError && error.code === "VAULT_DENIED") denied = error;
    else throw error;
  }

  if (denied || !playback) {
    return (
      <div>
        <PageHeader kicker="Protected IP" title="Sign NDA to view this prototype" />
        <EmptyState title="Access denied" body={denied?.userMessage ?? "Sign an NDA to view this prototype."} />
        <div className="mt-6 max-w-xs">
          <RequestNdaButton studentId={studentId} />
        </div>
      </div>
    );
  }

  const expires =
    typeof playback.expiresAt === "string" ? playback.expiresAt : new Date(playback.expiresAt).toISOString();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        kicker="Audited access"
        title="Vault viewer"
        description={`Grant URL expires ${formatWhen(expires)}. Watermark ${playback.watermarkToken}.`}
        actions={
          <a href={playback.url} className={cn(buttonVariants({ variant: "ghost" }))} download>
            Download
          </a>
        }
      />
      <VaultViewer url={playback.url} contentType={playback.contentType} watermark={playback.watermarkToken} />
      <Link href={`/vault/${studentId}`} className="mt-4 inline-block text-sm text-muted-foreground hover:text-foreground">
        ← All files
      </Link>
    </div>
  );
}
