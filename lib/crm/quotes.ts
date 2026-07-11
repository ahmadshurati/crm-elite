import type { LineItem } from "@/lib/crm/line-items";

export const QUOTE_STATUSES = ["draft", "sent", "approved", "rejected"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const quoteStatusLabels: Record<QuoteStatus, string> = {
  draft: "مسودة",
  sent: "مُرسل",
  approved: "موافق عليه",
  rejected: "مرفوض",
};

export type QuoteRecord = {
  id: number;
  customerId: number;
  createdByUserId: number | null;
  quoteNumber: string;
  title: string;
  status: QuoteStatus | string;
  lineItems: LineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  total: number;
  validUntil: string | null;
  notes: string | null;
  customerName?: string | null;
  createdByUsername?: string | null;
  createdAt: string;
  updatedAt: string;
};

export function isQuoteStatus(value: string): value is QuoteStatus {
  return (QUOTE_STATUSES as readonly string[]).includes(value);
}
