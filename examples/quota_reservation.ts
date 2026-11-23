/**
 * Reservation and settlement for metered operations.
 *
 * Demonstrates the pattern used for metered AI calls: reserve a slot inside a
 * transaction before the expensive call, then settle or roll back. Settlement is
 * idempotent so a retried request cannot charge twice, and expired reservations
 * are swept instead of leaking capacity.
 *
 * Run: npx tsx quota_reservation.ts
 */

type Reservation = {
  id: string;
  subject: string;
  state: "held" | "settled" | "released";
  createdAt: number;
};

const TTL_MS = 60_000;
const DAILY_LIMIT = 3;

export class QuotaStore {
  private reservations = new Map<string, Reservation>();

  constructor(private readonly now: () => number = Date.now) {}

  private usedToday(subject: string): number {
    return [...this.reservations.values()].filter(
      (r) => r.subject === subject && r.state !== "released",
    ).length;
  }

  /** Reserves a slot atomically with respect to the limit check. */
  reserve(subject: string, idempotencyKey: string): Reservation {
    const existing = this.reservations.get(idempotencyKey);
    if (existing) return existing; // same request retried: no double charge

    if (this.usedToday(subject) >= DAILY_LIMIT) {
      throw new Error("QUOTA_EXCEEDED");
    }

    const reservation: Reservation = {
      id: idempotencyKey,
      subject,
      state: "held",
      createdAt: this.now(),
    };
    this.reservations.set(idempotencyKey, reservation);
    return reservation;
  }

  /** Applies the effect of a successful call. Safe to call twice. */
  settle(idempotencyKey: string): void {
    const reservation = this.reservations.get(idempotencyKey);
    if (!reservation) throw new Error("UNKNOWN_RESERVATION");
    if (reservation.state === "settled") return;
    if (reservation.state === "released") throw new Error("RESERVATION_RELEASED");
    reservation.state = "settled";
  }

  /** Restores capacity when the call failed before producing a result. */
  release(idempotencyKey: string): void {
    const reservation = this.reservations.get(idempotencyKey);
    if (!reservation || reservation.state !== "held") return;
    reservation.state = "released";
  }

  /** Frees slots held by a process that died between reserve and settle. */
  sweep(): number {
    let released = 0;
    for (const reservation of this.reservations.values()) {
      if (reservation.state === "held" && this.now() - reservation.createdAt > TTL_MS) {
        reservation.state = "released";
        released += 1;
      }
    }
    return released;
  }
}

// --- demonstration ---------------------------------------------------------
const clock = { t: 0 };
const store = new QuotaStore(() => clock.t);

const first = store.reserve("student-1", "msg-1");
store.settle("msg-1");
store.settle("msg-1"); // idempotent, no effect

store.reserve("student-1", "msg-2");
store.release("msg-2"); // provider failed before the first token

const third = store.reserve("student-1", "msg-3");
store.settle(third.id);

console.log("settled:", first.state, third.state);
console.log("used:", store.usedToday("student-1"), "of", DAILY_LIMIT);

clock.t += TTL_MS + 1;
store.reserve("student-1", "msg-4");
console.log("swept:", store.sweep(), "released reservations");
