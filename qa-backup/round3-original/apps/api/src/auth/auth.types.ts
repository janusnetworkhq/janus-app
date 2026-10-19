import { User, UserRole, UserStatus } from "@prisma/client";

export type AuthedUser = User & {
  studentProfile?: { university: string | null; headline: string | null; city: string | null } | null;
  recruiterProfile?: { orgId: string; title: string | null; org?: { status: string } } | null;
};

export function assertActive(user: Pick<User, "status">): void {
  if (user.status === UserStatus.SUSPENDED) {
    throw Object.assign(new Error("Account suspended"), { status: 403, code: "SUSPENDED" });
  }
  if (user.status === UserStatus.DELETED) {
    throw Object.assign(new Error("Account deleted"), { status: 403, code: "DELETED" });
  }
}

export function hasRole(user: Pick<User, "role">, roles: UserRole[]): boolean {
  return Boolean(user.role && roles.includes(user.role));
}
