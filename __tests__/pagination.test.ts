import { describe, expect, it } from "vitest";
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
  buildPaginationMeta,
  parsePaginationParams,
} from "@/lib/pagination";

describe("parsePaginationParams", () => {
  it("uses defaults when params are missing", () => {
    const url = new URL("https://example.com/api/customers");
    const result = parsePaginationParams(url);

    expect(result.page).toBe(DEFAULT_PAGE);
    expect(result.limit).toBe(DEFAULT_LIMIT);
    expect(result.offset).toBe(0);
  });

  it("clamps invalid page values to at least 1", () => {
    const url = new URL("https://example.com/api/customers?page=0&limit=10");
    const result = parsePaginationParams(url);

    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
    expect(result.offset).toBe(0);
  });

  it("caps limit at MAX_LIMIT", () => {
    const url = new URL(`https://example.com/api/customers?page=2&limit=${MAX_LIMIT + 500}`);
    const result = parsePaginationParams(url);

    expect(result.page).toBe(2);
    expect(result.limit).toBe(MAX_LIMIT);
    expect(result.offset).toBe(MAX_LIMIT);
  });
});

describe("buildPaginationMeta", () => {
  it("returns at least one total page", () => {
    expect(buildPaginationMeta(1, 50, 0)).toEqual({
      page: 1,
      limit: 50,
      total: 0,
      totalPages: 1,
    });
  });

  it("calculates total pages for partial last page", () => {
    expect(buildPaginationMeta(1, 50, 101)).toEqual({
      page: 1,
      limit: 50,
      total: 101,
      totalPages: 3,
    });
  });
});
