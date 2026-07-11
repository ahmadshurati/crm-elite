import { describe, expect, it } from "vitest";
import { isPlatformOwner, slugifyCompanyName, PLATFORM_OWNER_ROLE } from "@/lib/tenant";

describe("tenant helpers", () => {
  it("detects platform owner role", () => {
    expect(isPlatformOwner({ role: PLATFORM_OWNER_ROLE })).toBe(true);
    expect(isPlatformOwner({ role: "master" })).toBe(false);
  });

  it("slugifies company names", () => {
    expect(slugifyCompanyName("شركة التأمين")).toBeTruthy();
    expect(slugifyCompanyName("  ABC Insurance  ")).toBe("abc-insurance");
  });
});
