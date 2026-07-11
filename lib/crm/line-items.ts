export type LineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export function parseLineItems(value: unknown): LineItem[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(normalizeLineItem).filter((item) => item.description || item.total > 0);
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parseLineItems(parsed);
    } catch {
      return [];
    }
  }
  return [];
}

export function normalizeLineItem(item: unknown): LineItem {
  const row = item as Record<string, unknown>;
  const quantity = Math.max(0, Number(row.quantity || 1));
  const unitPrice = Math.max(0, Number(row.unitPrice || 0));
  const total = Number(row.total ?? quantity * unitPrice);
  return {
    description: String(row.description || "").trim(),
    quantity,
    unitPrice,
    total: Number.isFinite(total) ? total : quantity * unitPrice,
  };
}

export function serializeLineItems(items: LineItem[]) {
  return JSON.stringify(items);
}

export function calculateDocumentTotals(input: {
  lineItems: LineItem[];
  taxRate?: number;
  discount?: number;
}) {
  const subtotal = input.lineItems.reduce((sum, item) => sum + item.total, 0);
  const taxRate = Math.max(0, Number(input.taxRate || 0));
  const discount = Math.max(0, Number(input.discount || 0));
  const taxable = Math.max(subtotal - discount, 0);
  const taxAmount = taxable * (taxRate / 100);
  const total = taxable + taxAmount;

  return {
    subtotal,
    taxRate,
    taxAmount,
    discount,
    total,
  };
}

export function nextDocumentNumber(prefix: string, latest?: string | null) {
  const year = new Date().getFullYear();
  const pattern = new RegExp(`^${prefix}-${year}-(\\d+)$`);
  const latestMatch = latest ? latest.match(pattern) : null;
  const next = latestMatch ? Number(latestMatch[1]) + 1 : 1;
  return `${prefix}-${year}-${String(next).padStart(4, "0")}`;
}
