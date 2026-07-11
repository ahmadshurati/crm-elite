import { describe, expect, it } from "vitest";
import { buildSidebarSections, sectionContainsKey } from "@/lib/crm/sidebar-config";

describe("sidebar config", () => {
  it("builds sections based on permissions", () => {
    const sections = buildSidebarSections({
      canViewSubscribers: true,
      canCreateSubscribers: true,
      canEditSubscribers: true,
      canViewAccidents: true,
      canViewAccounting: true,
      canViewUsers: true,
      canEditUsers: true,
      canViewActivityLog: true,
      renewalsThisMonthCount: 3,
    });

    expect(sections.length).toBeGreaterThan(4);
    expect(sections.some((s) => sectionContainsKey(s, "dashboard"))).toBe(true);
    expect(sections.some((s) => sectionContainsKey(s, "active-subscribers"))).toBe(true);
    expect(sections.some((s) => sectionContainsKey(s, "accident"))).toBe(true);
  });

  it("hides admin when user lacks permissions", () => {
    const sections = buildSidebarSections({
      canViewSubscribers: true,
      canCreateSubscribers: false,
      canEditSubscribers: false,
      canViewAccidents: false,
      canViewAccounting: false,
      canViewUsers: false,
      canEditUsers: false,
      canViewActivityLog: false,
      renewalsThisMonthCount: 0,
    });

    expect(sections.some((s) => s.id === "admin")).toBe(false);
    expect(sections.some((s) => s.id === "subscriber-tools")).toBe(false);
  });
});
