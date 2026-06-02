import { describe, expect, it } from "vitest";
import {
  buildSectionUrl,
  isMenuKey,
  parseMenuFromSearchParams,
} from "@/lib/menu-navigation";

describe("menu navigation", () => {
  it("validates menu keys", () => {
    expect(isMenuKey("accident")).toBe(true);
    expect(isMenuKey("invalid-section")).toBe(false);
  });

  it("parses section from search params", () => {
    const params = new URLSearchParams("section=accounting");
    expect(parseMenuFromSearchParams(params)).toBe("accounting");
  });

  it("falls back for invalid section values", () => {
    const params = new URLSearchParams("section=unknown");
    expect(parseMenuFromSearchParams(params, "accident")).toBe("accident");
  });

  it("builds section URLs", () => {
    const params = new URLSearchParams("q=test");
    expect(buildSectionUrl("/", "accident", params)).toBe("/?q=test&section=accident");
  });
});
