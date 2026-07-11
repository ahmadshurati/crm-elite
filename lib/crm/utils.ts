import type {
  AccidentStatus,
  InsuranceMainType,
  InsuranceStatus,
  PaidStatus,
} from "@/lib/crm/types";

export function buildInsuranceText(type: InsuranceMainType, hofaa: boolean) {
  let text = "";

  if (type === "third") text = "طرف ثالث";
  if (type === "full") text = "شامل";
  if (hofaa) text = text ? `${text} + حوفا` : "حوفا";

  return text || "غير محدد";
}

export function parseInsuranceText(text: string) {
  return {
    hofaa: text.includes("حوفا"),
    type: text.includes("طرف ثالث")
      ? ("third" as InsuranceMainType)
      : text.includes("شامل")
        ? ("full" as InsuranceMainType)
        : ("" as InsuranceMainType),
  };
}

export function statusColor(status: string) {
  if (status === "فعال") return "bg-emerald-50 text-emerald-700";
  if (status === "جديد") return "bg-blue-50 text-blue-700";
  if (status === "غير فعال") return "bg-orange-50 text-orange-700";
  return "bg-rose-50 text-rose-700";
}

export function paidColor(status: string) {
  if (status.includes("فيزا") && status.includes("كاش")) return "bg-cyan-50 text-cyan-700";
  if (status.includes("شيكات") && (status.includes("كاش") || status.includes("فيزا")))
    return "bg-purple-50 text-purple-700";
  if (status === "فيزا") return "bg-indigo-50 text-indigo-700";
  if (status === "كاش") return "bg-emerald-50 text-emerald-700";
  if (status === "شيكات") return "bg-amber-50 text-amber-700";
  return "bg-rose-50 text-rose-700";
}

export function accidentStatusColor(status: AccidentStatus) {
  if (status === "مفتوح") return "bg-emerald-50 text-emerald-700";
  return "bg-slate-100 text-slate-700";
}

export function todayString() {
  return new Date().toISOString().split("T")[0];
}

export function formatDateForInput(value: unknown) {
  if (!value) return "";

  const date = new Date(value as string | number | Date);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toISOString().split("T")[0];
}

export function parseEndDate(value: string) {
  if (!value) return null;

  const text = String(value).trim();
  const parts = text.split("-");

  if (parts.length === 3) {
    const first = Number(parts[0]);
    const second = Number(parts[1]);
    const third = Number(parts[2]);

    if (!Number.isNaN(first) && !Number.isNaN(second) && !Number.isNaN(third)) {
      if (parts[0].length === 4) return new Date(first, second - 1, third);
      return new Date(third, second - 1, first);
    }
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;

  return date;
}

export function isExpiringThisMonth(endDateValue: string) {
  const endDate = parseEndDate(endDateValue);
  if (!endDate) return false;

  const today = new Date();

  return endDate.getMonth() === today.getMonth() && endDate.getFullYear() === today.getFullYear();
}

export function isPastDate(value: string) {
  const date = parseEndDate(value);
  if (!date) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  return date < today;
}

export function normalizeStatus(value: unknown): InsuranceStatus {
  const text = String(value ?? "").trim().toLowerCase();

  if (text === "0") return "غير فعال";
  if (text === "جديد" || text === "new") return "جديد";
  if (text === "منتهي" || text === "expired") return "منتهي";

  return "فعال";
}

export function normalizePaid(value: unknown): PaidStatus {
  const text = String(value ?? "").trim().toLowerCase();

  const hasCash = text.includes("cash") || text.includes("كاش");
  const hasVisa = text.includes("visa") || text.includes("فيزا");
  const hasChecks =
    text.includes("check") ||
    text.includes("cheque") ||
    text.includes("شيك") ||
    text.includes("شيكات");

  const methods: string[] = [];
  if (hasCash) methods.push("كاش");
  if (hasVisa) methods.push("فيزا");
  if (hasChecks) methods.push("شيكات");

  return (methods.length > 0 ? methods.join(" + ") : "لاحقًا") as PaidStatus;
}

export function numberValue(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function normalizeSearchText(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function compactSearchText(value: unknown) {
  return normalizeSearchText(value).replace(/\s+/g, "");
}

export function calcPaymentStatus(totalAmount: number, paidAmount: number) {
  if (totalAmount <= 0 && paidAmount <= 0) return "غير مدفوع";
  if (paidAmount <= 0) return "غير مدفوع";
  if (paidAmount >= totalAmount) return "مدفوع كامل";
  return "مدفوع جزئي";
}

export function formatMoney(value: number) {
  return `${numberValue(value).toLocaleString("he-IL")} ₪`;
}

export function paymentStatusColor(status: string) {
  if (status === "مدفوع كامل") return "bg-emerald-50 text-emerald-700";
  if (status === "مدفوع جزئي") return "bg-amber-50 text-amber-700";
  return "bg-rose-50 text-rose-700";
}
