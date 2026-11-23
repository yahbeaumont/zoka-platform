/**
 * Entitlement resolved from state, with claims as cache only.
 *
 * Demonstrates why a plan check must read the subscription record instead of
 * trusting a token, and how a family plan and a time-boxed voucher grant can
 * coexist without being modelled as fake subscriptions.
 *
 * Run: npx tsx entitlement.ts
 */

export type Plan = "free" | "pro" | "family";

type Subscription = {
  userId: string;
  plan: Plan;
  status: "active" | "past_due" | "canceled";
  currentPeriodEnd: string; // ISO date
  seats: number;
};

type Grant = {
  userId: string;
  plan: Plan;
  source: "voucher" | "manual";
  expiresAt: string;
};

type FamilyMember = { titularId: string; memberId: string };

export type Entitlement = {
  plan: Plan;
  reason: "subscription" | "grant" | "family_member" | "none";
  expiresAt?: string;
};

const isActive = (s: Subscription, now: Date) =>
  s.status === "active" && new Date(s.currentPeriodEnd) > now;

/** Pure resolution: same inputs always produce the same answer. */
export function resolve(
  userId: string,
  subs: Subscription[],
  grants: Grant[],
  family: FamilyMember[],
  now = new Date(),
): Entitlement {
  const own = subs.find((s) => s.userId === userId && isActive(s, now));
  if (own) return { plan: own.plan, reason: "subscription", expiresAt: own.currentPeriodEnd };

  const valid = grants
    .filter((g) => g.userId === userId && new Date(g.expiresAt) > now)
    .sort((a, b) => new Date(b.expiresAt).getTime() - new Date(a.expiresAt).getTime());
  if (valid[0]) return { plan: valid[0].plan, reason: "grant", expiresAt: valid[0].expiresAt };

  const link = family.find((f) => f.memberId === userId);
  if (link) {
    const titular = subs.find((s) => s.userId === link.titularId && isActive(s, now));
    if (titular) {
      return { plan: titular.plan, reason: "family_member", expiresAt: titular.currentPeriodEnd };
    }
  }

  return { plan: "free", reason: "none" };
}

/** Claims are a projection of the resolved entitlement, never the source. */
export function claimsFor(e: Entitlement): { plan: Plan; entitlementVersion: string } {
  return { plan: e.plan, entitlementVersion: `${e.plan}:${e.reason}` };
}

// --- demonstration ---------------------------------------------------------
const now = new Date("2026-11-23T12:00:00Z");
const subs: Subscription[] = [
  { userId: "u-titular", plan: "family", status: "active", currentPeriodEnd: "2026-12-20T00:00:00Z", seats: 4 },
  { userId: "u-lapsed", plan: "pro", status: "canceled", currentPeriodEnd: "2026-10-01T00:00:00Z", seats: 1 },
];
const grants: Grant[] = [
  { userId: "u-sponsored", plan: "pro", source: "voucher", expiresAt: "2027-01-15T00:00:00Z" },
];
const family: FamilyMember[] = [{ titularId: "u-titular", memberId: "u-dependant" }];

for (const id of ["u-titular", "u-dependant", "u-sponsored", "u-lapsed"]) {
  const e = resolve(id, subs, grants, family, now);
  console.log(id.padEnd(12), e.plan.padEnd(7), e.reason, JSON.stringify(claimsFor(e)));
}
