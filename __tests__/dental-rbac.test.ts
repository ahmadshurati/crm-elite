import { describe, expect, it } from "vitest";
import { permissionsForRole, resolveDentalRole, roleCan } from "@/lib/dental/rbac";

describe("dental RBAC", () => {
  it("maps company master to owner and honours explicit dental roles", () => {
    expect(resolveDentalRole("master", null)).toBe("owner");
    expect(resolveDentalRole("user", "dentist")).toBe("dentist");
    expect(resolveDentalRole("user", "ACCOUNTANT")).toBe("accountant"); // case-insensitive
    expect(resolveDentalRole("user", null)).toBe("reception"); // safe default
    expect(resolveDentalRole("user", "bogus")).toBe("reception");
  });

  it("enforces least privilege for payments voiding", () => {
    expect(roleCan("accountant", "payments.void")).toBe(true);
    expect(roleCan("owner", "payments.void")).toBe(true);
    expect(roleCan("reception", "payments.void")).toBe(false);
    expect(roleCan("dentist", "payments.void")).toBe(false);
  });

  it("restricts user management to owner/manager", () => {
    expect(roleCan("owner", "users.manage")).toBe(true);
    expect(roleCan("manager", "users.manage")).toBe(true);
    expect(roleCan("dentist", "users.manage")).toBe(false);
    expect(roleCan("assistant", "users.manage")).toBe(false);
  });

  it("gives clinicians clinical permissions but not reception-only billing create", () => {
    expect(roleCan("dentist", "chart.edit")).toBe(true);
    expect(roleCan("dentist", "treatments.complete")).toBe(true);
    expect(roleCan("assistant", "payments.create")).toBe(false);
    expect(roleCan("reception", "appointments.manage")).toBe(true);
  });

  it("owner has the full permission set", () => {
    const owner = permissionsForRole("owner");
    expect(owner).toContain("settings.manage");
    expect(owner).toContain("audit.view");
    expect(owner.length).toBeGreaterThanOrEqual(permissionsForRole("reception").length);
  });
});
