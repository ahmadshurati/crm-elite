export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export function parsePaginationParams(url: URL) {
  const page = Math.max(1, Number(url.searchParams.get("page") || DEFAULT_PAGE));
  const rawLimit = Number(url.searchParams.get("limit") || DEFAULT_LIMIT);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : DEFAULT_LIMIT));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

export function buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
