import type { PaginationMeta } from "@/lib/crm/types";

export function TablePagination({
  pagination,
  onPageChange,
  loading,
}: {
  pagination: PaginationMeta | null;
  onPageChange: (page: number) => void;
  loading?: boolean;
}) {
  if (!pagination || pagination.totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-between border-t border-[#EEF1F4] px-5 py-4 text-[13px] text-[#707A84]">
      <span>
        صفحة {pagination.page} من {pagination.totalPages} ({pagination.total} سجل)
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={loading || pagination.page <= 1}
          onClick={() => onPageChange(pagination.page - 1)}
          className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 font-bold text-[#0F8B94] transition hover:bg-[#F1FBFA] disabled:cursor-not-allowed disabled:opacity-50"
        >
          السابق
        </button>
        <button
          type="button"
          disabled={loading || pagination.page >= pagination.totalPages}
          onClick={() => onPageChange(pagination.page + 1)}
          className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 font-bold text-[#0F8B94] transition hover:bg-[#F1FBFA] disabled:cursor-not-allowed disabled:opacity-50"
        >
          التالي
        </button>
      </div>
    </div>
  );
}
