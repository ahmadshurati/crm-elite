"use client";

import type { LucideIcon } from "lucide-react";

export function KpiCard({
  label,
  value,
  helper,
  icon: Icon,
  onClick,
  loading,
  accent = "teal",
}: {
  label: string;
  value: string | number;
  helper?: string;
  icon: LucideIcon;
  onClick?: () => void;
  loading?: boolean;
  accent?: "teal" | "blue" | "amber" | "rose" | "violet";
}) {
  const accents = {
    teal: "bg-[#E7F6F5] text-[#0F8B94]",
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
    violet: "bg-violet-50 text-violet-600",
  };

  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`group w-full rounded-[24px] border border-[#EAECEF] bg-white p-5 text-right shadow-sm transition ${
        onClick ? "hover:border-[#0F8B94]/30 hover:shadow-md" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[#707A84]">{label}</p>
          {loading ? (
            <div className="mt-3 h-9 w-24 animate-pulse rounded-lg bg-[#F1F5F9]" />
          ) : (
            <p className="mt-2 truncate text-2xl font-bold tracking-tight text-[#1F2937]">{value}</p>
          )}
          {helper && <p className="mt-1 text-xs text-[#94A3B8]">{helper}</p>}
        </div>
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${accents[accent]} transition group-hover:scale-105`}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </Wrapper>
  );
}
