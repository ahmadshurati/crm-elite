import { describe, expect, it, vi } from "vitest";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";

describe("isAuthorizedCronRequest", () => {
  it("allows requests when CRON_SECRET is not configured outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("CRON_SECRET", "");

    const req = new Request("http://localhost/api/cron/expire-insurances");
    expect(isAuthorizedCronRequest(req)).toBe(true);

    vi.unstubAllEnvs();
  });

  it("requires bearer token when CRON_SECRET is configured", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CRON_SECRET", "test-secret");

    const unauthorized = new Request("http://localhost/api/cron/expire-insurances");
    const authorized = new Request("http://localhost/api/cron/expire-insurances", {
      headers: { authorization: "Bearer test-secret" },
    });

    expect(isAuthorizedCronRequest(unauthorized)).toBe(false);
    expect(isAuthorizedCronRequest(authorized)).toBe(true);

    vi.unstubAllEnvs();
  });
});
