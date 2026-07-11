import type { LineItem } from "@/lib/crm/line-items";

type PrintableDocument = {
  kind: "quote" | "invoice";
  number: string;
  title: string;
  status: string;
  customerName: string;
  customerPhone?: string | null;
  lineItems: LineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  total: number;
  paidAmount?: number;
  validUntil?: string | null;
  dueDate?: string | null;
  notes?: string | null;
  createdAt: string;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("ar", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ar", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function buildPrintableHtml(doc: PrintableDocument) {
  const kindLabel = doc.kind === "quote" ? "عرض سعر" : "فاتورة";

  const rows = doc.lineItems
    .map(
      (item) => `
      <tr>
        <td>${item.description || "-"}</td>
        <td>${item.quantity}</td>
        <td>${formatMoney(item.unitPrice)}</td>
        <td>${formatMoney(item.total)}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>${kindLabel} ${doc.number}</title>
  <style>
    body { font-family: Tahoma, Arial, sans-serif; color: #1f2937; margin: 32px; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    .meta { color: #6b7280; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
    .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { border-bottom: 1px solid #eef1f4; padding: 10px 8px; text-align: right; }
    th { background: #f8fafc; color: #6b7280; }
    .totals { margin-top: 24px; width: 320px; margin-right: auto; }
    .totals div { display: flex; justify-content: space-between; padding: 6px 0; }
    .total { font-size: 18px; font-weight: bold; color: #0f8b94; border-top: 1px solid #e5e7eb; padding-top: 10px; }
    @media print { body { margin: 16px; } button { display: none; } }
  </style>
</head>
<body>
  <button onclick="window.print()" style="margin-bottom:16px;padding:10px 16px;background:#0f8b94;color:#fff;border:none;border-radius:8px;cursor:pointer;">طباعة / حفظ PDF</button>
  <h1>${kindLabel}: ${doc.title}</h1>
  <div class="meta">رقم ${doc.number} · الحالة: ${doc.status} · التاريخ: ${formatDate(doc.createdAt)}</div>
  <div class="grid">
    <div class="card">
      <strong>العميل</strong>
      <div>${doc.customerName}</div>
      ${doc.customerPhone ? `<div dir="ltr">${doc.customerPhone}</div>` : ""}
    </div>
    <div class="card">
      <strong>تفاصيل</strong>
      ${doc.kind === "quote" ? `<div>صالح حتى: ${formatDate(doc.validUntil)}</div>` : ""}
      ${doc.kind === "invoice" ? `<div>تاريخ الاستحقاق: ${formatDate(doc.dueDate)}</div>` : ""}
      ${doc.kind === "invoice" && doc.paidAmount != null ? `<div>المدفوع: ${formatMoney(doc.paidAmount)}</div>` : ""}
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>الوصف</th>
        <th>الكمية</th>
        <th>السعر</th>
        <th>الإجمالي</th>
      </tr>
    </thead>
    <tbody>${rows || "<tr><td colspan='4'>لا توجد بنود</td></tr>"}</tbody>
  </table>
  <div class="totals">
    <div><span>المجموع الفرعي</span><span>${formatMoney(doc.subtotal)}</span></div>
    <div><span>الخصم</span><span>${formatMoney(doc.discount)}</span></div>
    <div><span>الضريبة (${doc.taxRate}%)</span><span>${formatMoney(doc.taxAmount)}</span></div>
    <div class="total"><span>الإجمالي</span><span>${formatMoney(doc.total)}</span></div>
  </div>
  ${doc.notes ? `<p style="margin-top:24px;color:#4b5563;"><strong>ملاحظات:</strong> ${doc.notes}</p>` : ""}
</body>
</html>`;
}
