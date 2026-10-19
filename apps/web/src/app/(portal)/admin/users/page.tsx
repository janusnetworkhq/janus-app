import type { Metadata } from "next";
import { nestGet } from "@/lib/api";
import type { AdminUser } from "@/lib/types";
import { formatWhen } from "@/lib/utils";
import { Badge, EmptyState, PageHeader } from "@/components/ui/feedback";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { UserModerationButtons } from "@/components/admin-actions";
import { AdminsOnly } from "@/components/admins-only";
import { getAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Users" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const admin = await getAdmin();
  if (!admin) return <AdminsOnly />;
  const { q } = await searchParams;
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  const users = await nestGet<AdminUser[]>(`/v1/admin/users${qs}`);

  return (
    <div>
      <PageHeader
        kicker="Moderation"
        title="Users"
        description="Suspend blocks sign-in on the next token refresh. Hard delete is not allowed."
        actions={
          <form className="flex gap-2" action="/admin/users">
            <Input name="q" placeholder="Handle or email" defaultValue={q} className="w-56" />
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>
        }
      />
      {users.length === 0 ? (
        <EmptyState title="No users" body="Try a different search." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Handle</Th>
              <Th>Email</Th>
              <Th>Role</Th>
              <Th>Status</Th>
              <Th>Joined</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <Td className="font-medium">@{user.handle}</Td>
                <Td className="text-muted-foreground">{user.email ?? "—"}</Td>
                <Td>
                  <Badge>{user.role ?? "—"}</Badge>
                </Td>
                <Td>
                  <Badge tone={user.status === "SUSPENDED" ? "danger" : "muted"}>{user.status}</Badge>
                </Td>
                <Td className="text-muted-foreground">{formatWhen(user.createdAt)}</Td>
                <Td>
                  {user.role === "PLATFORM_ADMIN" ? (
                    <span className="text-xs text-muted-foreground">Protected</span>
                  ) : (
                    <UserModerationButtons id={user.id} status={user.status} />
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
