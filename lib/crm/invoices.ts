import type { LineItem } from "@/lib/crm/line-items";

export const INVOICE_STATUSES = ["draft", "unpaid", "partial", "paid", "overdue", "cancelled"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  draft: "مسودة",
  unpaid: "غير مدفوعة",
  partial: "مدفوعة جزئياً",
  paid: "مدفوعة",
  overdue: "متأخرة",
  cancelled: "ملغاة",
};

export type InvoiceRecord = {
  id: number;
  customerId: number;
  quoteId: number | null;
  insuranceId: number | null;
  createdByUserId: number | null;
  invoiceNumber: string;
  title: string;
  status: InvoiceStatus | string;
  lineItems: LineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  total: number;
  paidAmount: number;
  dueDate: string | null;
  notes: string | null;
  customerName?: string | null;
  createdByUsername?: string | null;
  createdAt: string;
  updatedAt: string;
};

export function isInvoiceStatus(value: string): value is InvoiceStatus {
  return (INVOICE_STATUSES as readonly string[]).includes(value);
}

export function deriveInvoiceStatus(total: number, paidAmount: number, dueDate: Date | null, currentStatus: string) {
  if (currentStatus === "cancelled" || currentStatus === "draft") return currentStatus;
  if (total <= 0 && paidAmount <= 0) return "unpaid";
  if (paidAmount >= total && total > 0) return "paid";
  if (paidAmount > 0 && paidAmount < total) return "partial";
  if (dueDate && dueDate.getTime() < Date.now()) return "overdue";
  return "unpaid";
}
