import { describe, expect, it } from "vitest";
import { appointmentsOverlap, clampDurationMin } from "@/lib/dental/money";

const at = (h: number, m = 0) => new Date(2026, 7, 20, h, m, 0, 0);

describe("appointment duration validation", () => {
  it("rejects non-positive / invalid durations with a safe default and caps extremes", () => {
    expect(clampDurationMin(45)).toBe(45);
    expect(clampDurationMin(0)).toBe(30);
    expect(clampDurationMin(-5)).toBe(30);
    expect(clampDurationMin("abc")).toBe(30);
    expect(clampDurationMin(null)).toBe(30);
    expect(clampDurationMin(30.6)).toBe(31);
    expect(clampDurationMin(99999)).toBe(600);
  });
});

describe("appointment conflict detection", () => {
  it("flags overlapping appointments", () => {
    // 10:00-10:30 vs 10:15-10:45 → overlap
    expect(appointmentsOverlap(at(10, 0), 30, at(10, 15), 30)).toBe(true);
    // identical slot
    expect(appointmentsOverlap(at(9, 0), 60, at(9, 0), 60)).toBe(true);
    // one contains the other
    expect(appointmentsOverlap(at(9, 0), 120, at(9, 30), 15)).toBe(true);
  });

  it("allows back-to-back appointments", () => {
    // 10:00-10:30 then 10:30-11:00 → no overlap
    expect(appointmentsOverlap(at(10, 0), 30, at(10, 30), 30)).toBe(false);
    // clearly separate
    expect(appointmentsOverlap(at(9, 0), 30, at(11, 0), 30)).toBe(false);
  });
});
