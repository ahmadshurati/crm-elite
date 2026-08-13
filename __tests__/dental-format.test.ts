import { describe, expect, it } from "vitest";
import { fmtDate, fmtMoney, safeDate, safeIso, statusToMessage } from "@/lib/dental/format";

describe("dental format helpers", () => {
  it("maps HTTP statuses to Arabic messages (with sensible fallbacks)", () => {
    expect(statusToMessage(0)).toContain("الاتصال");
    expect(statusToMessage(401)).toContain("الجلسة");
    expect(statusToMessage(403)).toContain("صلاحية");
    expect(statusToMessage(404)).toContain("غير موجود");
    expect(statusToMessage(409)).toContain("تعارض");
    expect(statusToMessage(429)).toContain("طلبات كثيرة");
    expect(statusToMessage(500)).toContain("الخادم");
    expect(statusToMessage(503)).toContain("الخادم"); // any 5xx
    expect(statusToMessage(418)).toBeTruthy(); // unknown → generic, non-empty
  });

  it("formats currency consistently with the shekel symbol and grouping", () => {
    expect(fmtMoney(1500)).toBe("₪ 1,500");
    expect(fmtMoney(0)).toBe("₪ 0");
    expect(fmtMoney(1234.5)).toBe("₪ 1,234.5");
    expect(fmtMoney(null)).toBe("₪ 0");
    expect(fmtMoney(undefined)).toBe("₪ 0");
  });

  it("renders credits/negative balances (e.g. overpayment) with a sign", () => {
    expect(fmtMoney(-500)).toBe("₪ -500");
    expect(fmtMoney(-1234.5)).toBe("₪ -1,234.5");
  });

  it("guards invalid dates instead of rendering 'Invalid Date'", () => {
    expect(fmtDate(null)).toBe("—");
    expect(fmtDate("")).toBe("—");
    expect(fmtDate("not-a-date")).toBe("—");
    expect(fmtDate("2026-08-13T00:00:00.000Z")).not.toBe("—");
  });

  it("safeIso/safeDate never throw on NULL / invalid / MySQL zero dates (the profile-500 bug class)", () => {
    // These would throw RangeError with a naive new Date(x).toISOString()
    expect(safeIso(null)).toBeNull();
    expect(safeIso("")).toBeNull();
    expect(safeIso("0000-00-00 00:00:00")).toBeNull();
    expect(safeIso("not-a-date")).toBeNull();
    expect(safeIso("2026-13-45")).toBeNull();
    expect(safeIso("2026-08-13T05:00:00.000Z")).toBe("2026-08-13T05:00:00.000Z");
    expect(safeIso(new Date("2026-08-13T05:00:00.000Z"))).toBe("2026-08-13T05:00:00.000Z");

    expect(safeDate("0000-00-00")).toBeNull();
    expect(safeDate("2026-08-13T05:00:00.000Z")).toBe("2026-08-13");
  });
});
