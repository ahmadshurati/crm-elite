import { query } from "@/lib/db";

function escapeCsvValue(value: unknown) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export async function buildAccountingCsv() {
  const rows = await query<any>(
    `SELECT
      c.name AS subscriberName,
      IFNULL(c.phone, '') AS customerNumber,
      car.carName,
      car.carNumber,
      i.insuranceCompany,
      i.insuranceType,
      i.totalAmount,
      i.paidAmount,
      i.remainingAmount,
      i.paymentStatus,
      i.paymentMethod,
      i.startDate,
      i.endDate,
      i.status
    FROM Insurance i
    INNER JOIN Customer c ON c.id = i.customerId
    INNER JOIN Car car ON car.id = i.carId
    ORDER BY i.id DESC`
  );

  const headers = [
    "اسم المشترك",
    "الهاتف",
    "السيارة",
    "رقم السيارة",
    "شركة التأمين",
    "نوع التأمين",
    "المطلوب",
    "المدفوع",
    "المتبقي",
    "حالة الدفع",
    "طريقة الدفع",
    "تاريخ البداية",
    "تاريخ النهاية",
    "حالة التأمين",
  ];

  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      [
        row.subscriberName,
        row.customerNumber,
        row.carName,
        row.carNumber,
        row.insuranceCompany,
        row.insuranceType,
        row.totalAmount,
        row.paidAmount,
        row.remainingAmount,
        row.paymentStatus,
        row.paymentMethod,
        row.startDate,
        row.endDate,
        row.status,
      ]
        .map(escapeCsvValue)
        .join(",")
    ),
  ];

  return `\uFEFF${lines.join("\n")}`;
}
