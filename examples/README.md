# Examples

Three self-contained files that illustrate techniques used in Zoka. They are written from scratch, use generic names and fictional data, and do not import anything from the product.

| File | Demonstrates | Run |
|---|---|---|
| `quota_reservation.ts` | Reserve before the expensive call, settle or roll back after, idempotent settlement, expiry sweep | `npx tsx quota_reservation.ts` |
| `sse_proxy.ts` | Proxying a provider stream as typed events, with a failure taxonomy and quota rollback before the first token | `npx tsx sse_proxy.ts` |
| `entitlement.ts` | Resolving a plan from subscription, grant and family state, with claims as a projection only | `npx tsx entitlement.ts` |

Requirements: Node 20 or later. `npx tsx` fetches the runner on demand; there is no package to install.

## Why these three

They are the parts that are easy to describe and hard to get right. A quota counter looks trivial until a provider times out. A streaming proxy looks trivial until the failure arrives before the first byte. An entitlement check looks trivial until a stale token grants a paid feature.

Each file keeps the state in memory on purpose, so the control flow is visible without a database. In production the same shapes run inside transactions and against managed services.
