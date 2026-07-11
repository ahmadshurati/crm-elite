import { withTransaction } from "@/lib/db";

function numberValue(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function parseDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export async function importCustomerRows(rows: Array<Record<string, string>>) {
  let imported = 0;
  const errors: string[] = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const line = index + 2;

    try {
      await withTransaction(async (tx) => {
        const customerResult = await tx.execute(
          "INSERT INTO Customer (name, phone, email, createdAt) VALUES (?, ?, ?, NOW())",
          [
            String(row.name || "").trim(),
            row.phone ? String(row.phone).trim() : null,
            row.email ? String(row.email).trim() : null,
          ]
        );

        const customerId = customerResult.insertId;
        const carResult = await tx.execute(
          "INSERT INTO Car (customerId, carName, carNumber, carYear) VALUES (?, ?, ?, ?)",
          [
            customerId,
            String(row.carName || "غير محدد"),
            String(row.carNumber || ""),
            row.carYear ? String(row.carYear) : null,
          ]
        );

        const totalAmount = numberValue(row.totalAmount);
        const paidAmount = numberValue(row.paidAmount);
        const remainingAmount = Math.max(totalAmount - paidAmount, 0);
        const paymentStatus =
          paidAmount <= 0 ? "غير مدفوع" : paidAmount >= totalAmount ? "مدفوع كامل" : "مدفوع جزئي";

        await tx.execute(
          `INSERT INTO Insurance (
            customerId, carId, insuranceType, insuranceCompany, startDate, endDate, status, paymentMethod,
            hofaaEnabled, hofaaPrice, thirdPartyEnabled, thirdPartyPrice, fullEnabled, fullPrice,
            totalAmount, paidAmount, cashAmount, visaAmount, checksAmount, remainingAmount, paymentStatus
          ) VALUES (?, ?, ?, ?, ?, ?, 'فعال', 'لاحقًا', 0, 0, 0, 0, 0, 0, ?, ?, 0, 0, 0, ?, ?)`,
          [
            customerId,
            carResult.insertId,
            String(row.insuranceType || "غير محدد"),
            String(row.insuranceCompany || "غير محدد"),
            parseDate(String(row.startDate || new Date().toISOString())),
            parseDate(String(row.endDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString())),
            totalAmount,
            paidAmount,
            remainingAmount,
            paymentStatus,
          ]
        );
      });

      imported += 1;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`السطر ${line}: ${message}`);
    }
  }

  return { imported, errors, total: rows.length };
}
