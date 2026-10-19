import { OrgPlan } from "@prisma/client";

/** Plan catalogue. Payments are not wired yet; limits are enforced server-side. */
export const PLANS = {
  [OrgPlan.FREE_PILOT]: { id: OrgPlan.FREE_PILOT, name: "Free pilot", priceInrMonthly: 0, ndaRequestsPerMonth: 20, seats: 3 },
  [OrgPlan.SAAS]: { id: OrgPlan.SAAS, name: "Janus SaaS", priceInrMonthly: 24_999, ndaRequestsPerMonth: 500, seats: 25 },
} as const;

export function monthStartUtc(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
