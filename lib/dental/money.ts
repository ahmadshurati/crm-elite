// Pure financial + scheduling helpers (no DB) — unit tested.

/** Convert a display amount (shekels) to integer cents, safely rounded. */
export function toCents(value: unknown): number {
  return Math.round(Number(value || 0) * 100);
}

/** Convert integer cents back to a display amount. */
export function toMoney(cents: unknown): number {
  return Number(cents || 0) / 100;
}

/** Patient responsibility = subtotal − discount − insurance (never negative). All in cents. */
export function computeResponsibility(subtotalCents: number, discountCents: number, insuranceCents: number): number {
  return Math.max(subtotalCents - discountCents - insuranceCents, 0);
}

/** Outstanding balance owed = responsibility − payments + adjustments. All in cents (may be negative = credit). */
export function computeBalance(responsibilityCents: number, paidCents: number, adjustmentsCents = 0): number {
  return responsibilityCents - paidCents + adjustmentsCents;
}

export type LedgerInput = { date: string; amount: number };

/** Sort ledger movements chronologically and attach a running balance to each. */
export function runningBalance<T extends LedgerInput>(entries: T[]): (T & { balance: number })[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  let running = 0;
  return sorted.map((e) => {
    running += e.amount;
    return { ...e, balance: running };
  });
}

/** Two time ranges overlap when each starts before the other ends. Durations in minutes. */
export function appointmentsOverlap(aStart: Date, aDurationMin: number, bStart: Date, bDurationMin: number): boolean {
  const aEnd = aStart.getTime() + aDurationMin * 60000;
  const bEnd = bStart.getTime() + bDurationMin * 60000;
  return aStart.getTime() < bEnd && bStart.getTime() < aEnd;
}
