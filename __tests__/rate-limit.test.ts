import { describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";

describe("rate limit", () => {
  it("allows requests under the limit", () => {
    const key = `test-${Date.now()}-allow`;
    const first = checkRateLimit(key, 3, 60_000);
    const second = checkRateLimit(key, 3, 60_000);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
  });

  it("blocks requests over the limit", () => {
    const key = `test-${Date.now()}-block`;

    checkRateLimit(key, 2, 60_000);
    checkRateLimit(key, 2, 60_000);
    const third = checkRateLimit(key, 2, 60_000);

    expect(third.allowed).toBe(false);
    resetRateLimit(key);
  });
});
