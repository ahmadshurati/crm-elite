import { describe, expect, it } from "vitest";
import { computeBalance, computeResponsibility, runningBalance, toCents, toMoney } from "@/lib/dental/money";

describe("dental money helpers", () => {
  it("converts money to integer cents without float drift", () => {
    expect(toCents(50.5)).toBe(5050);
    expect(toCents(0.1)).toBe(10);
    expect(toCents(1500)).toBe(150000);
    expect(toCents("")).toBe(0);
    expect(toCents(null)).toBe(0);
  });

  it("converts cents back to money", () => {
    expect(toMoney(5050)).toBe(50.5);
    expect(toMoney(0)).toBe(0);
  });

  it("computes patient responsibility (subtotal - discount - insurance, never negative)", () => {
    expect(computeResponsibility(150000, 50000, 0)).toBe(100000);
    expect(computeResponsibility(150000, 20000, 30000)).toBe(100000);
    expect(computeResponsibility(1000, 2000, 0)).toBe(0); // clamped
  });

  it("computes outstanding balance including adjustments", () => {
    expect(computeBalance(100000, 50000)).toBe(50000);
    expect(computeBalance(100000, 50000, -10000)).toBe(40000); // credit reduces
    expect(computeBalance(100000, 50000, 5000)).toBe(55000); // refund/extra charge increases
  });

  it("builds a running ledger balance in chronological order", () => {
    const ledger = runningBalance([
      { date: "2026-02-10", amount: 150000 }, // charge
      { date: "2026-02-01", amount: -50000 }, // earlier payment
      { date: "2026-02-15", amount: -30000 }, // later payment
    ]);
    expect(ledger.map((e) => e.balance)).toEqual([-50000, 100000, 70000]);
    expect(ledger[ledger.length - 1].balance).toBe(70000);
  });
});
