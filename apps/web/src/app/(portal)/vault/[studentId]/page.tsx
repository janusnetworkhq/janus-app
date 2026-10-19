import type { Metadata } from "next";
import Link from "next/link";
import { nestGet } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import type { VaultAsset } from "@/lib/types";
import { formatBytes, formatWhen } from "@/lib/utils";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { RequestNdaButton } from "@/components/request-nda-button";
import { Table, Td, Th } from "@/components/ui/table";

export const metadata: Metadata = { title: "Vault" };

export default async function VaultListPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  let items: VaultAsset[] | null = null;
  let denied = false;
  try {
    items = (await nestGet<{ items: VaultAsset[] }>(`/v1/vault/students/${studentId}`)).items;
  } catch (error) {
    if (error instanceof ApiError && error.code === "VAULT_DENIED") denied = true;
    else throw error;
  }

  if (denied) {
    return (
      <div>
        <PageHeader kicker="Protected IP" title="Sign NDA to view this prototype" />
        <EmptyState
          title="Vault is locked"
          body="Bytes leave storage only after a signed agreement and a short-lived grant."
        />
        <div className="mt-6 max-w-xs">
          <RequestNdaButton studentId={studentId} />
        </div>
      </div>
    );
  }

  const files = items ?? [];
  return (
    <div>
      <PageHeader
        kicker="Protected IP"
        title="Vault"
        description="Every open is audited. URLs expire; do not forward them."
      />
      {files.length === 0 ? (
        <EmptyState title="Empty vault" body="This student has not attached protected files yet." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>File</Th>
              <Th>Type</Th>
              <Th>Size</Th>
              <Th>Added</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {files.map((asset) => (
              <tr key={asset.id}>
                <Td className="font-medium">{asset.originalName ?? asset.kind}</Td>
                <Td className="text-muted-foreground">{asset.contentType}</Td>
                <Td>{formatBytes(asset.byteSize)}</Td>
                <Td className="text-muted-foreground">{formatWhen(asset.createdAt)}</Td>
                <Td>
                  <Link href={`/vault/${studentId}/${asset.id}`} className="text-sm font-semibold text-primary">
                    Open
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
