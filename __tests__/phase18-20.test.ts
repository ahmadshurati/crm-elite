import { describe, expect, it } from "vitest";
import { buildPaginationMeta } from "@/lib/pagination";

describe("backup and v1 pagination", () => {
  it("builds pagination meta for external API responses", () => {
    const meta = buildPaginationMeta(2, 50, 120);
    expect(meta.page).toBe(2);
    expect(meta.totalPages).toBe(3);
    expect(meta.total).toBe(120);
  });
});
