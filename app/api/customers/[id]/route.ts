import { NextResponse } from "next/server";
import { execute, queryOne } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function numberValue(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function calcPaymentStatus(totalAmount: number, paidAmount: number) {
  if (totalAmount <= 0 && paidAmount <= 0) return "غير مدفوع";
  if (paidAmount <= 0) return "غير مدفوع";
  if (paidAmount >= totalAmount) return "مدفوع كامل";
  return "مدفوع جزئي";
}

function fileNameFromUrl(url: string) {
  return url.split("/").pop() || "file";
}

function buildDocumentRows(insuranceId: number, body: any) {
  const rows: any[] = [];
  const addDocument = (type: string, fileUrl: unknown) => {
    const url = String(fileUrl || "").trim();
    if (!url || url.includes("placehold.co")) return;
    rows.push([insuranceId, type, url, fileNameFromUrl(url)]);
  };

  addDocument("policyImage", body.policyImage);

  if (body.documents && typeof body.documents === "object") {
    addDocument("drivingLicense", body.documents.drivingLicense);
    addDocument("insurancePolicy1", body.documents.insurancePolicy1);
    addDocument("insurancePolicy2", body.documents.insurancePolicy2);
    addDocument("other", body.documents.other);
  }

  return rows;
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await req.json();

    const customerId = Number(id);
    const carId = Number(body.carId);
    const insuranceId = Number(body.insuranceId);

    const hofaaPrice = numberValue(body.hofaaPrice);
    const thirdPartyPrice = numberValue(body.thirdPartyPrice);
    const fullPrice = numberValue(body.fullPrice);
    const totalAmount = numberValue(body.totalAmount || hofaaPrice + thirdPartyPrice + fullPrice);
    const paidAmount = numberValue(body.paidAmount);
    const remainingAmount = Math.max(totalAmount - paidAmount, 0);
    const paymentStatus = calcPaymentStatus(totalAmount, paidAmount);

    await execute("UPDATE Customer SET name = ?, phone = ? WHERE id = ?", [
      String(body.name || ""),
      body.phone ? String(body.phone) : null,
      customerId,
    ]);

    await execute("UPDATE Car SET carName = ?, carNumber = ? WHERE id = ?", [
      String(body.carName || ""),
      String(body.carNumber || ""),
      carId,
    ]);

    await execute(
      `UPDATE Insurance SET
        insuranceType = ?, insuranceCompany = ?, startDate = ?, endDate = ?, status = ?, paymentMethod = ?,
        hofaaEnabled = ?, hofaaPrice = ?, thirdPartyEnabled = ?, thirdPartyPrice = ?, fullEnabled = ?, fullPrice = ?,
        totalAmount = ?, paidAmount = ?, remainingAmount = ?, paymentStatus = ?
      WHERE id = ?`,
      [
        String(body.insuranceType || ""),
        String(body.insuranceCompany || ""),
        new Date(body.startDate),
        new Date(body.endDate),
        String(body.status || "فعال"),
        String(body.paymentMethod || "لاحقًا"),
        body.hofaaEnabled ? 1 : 0,
        hofaaPrice,
        body.thirdPartyEnabled ? 1 : 0,
        thirdPartyPrice,
        body.fullEnabled ? 1 : 0,
        fullPrice,
        totalAmount,
        paidAmount,
        remainingAmount,
        paymentStatus,
        insuranceId,
      ]
    );

    await execute("DELETE FROM Document WHERE insuranceId = ?", [insuranceId]);
    for (const row of buildDocumentRows(insuranceId, body)) {
      await execute("INSERT INTO Document (insuranceId, type, fileUrl, fileName) VALUES (?, ?, ?, ?)", row);
    }

    await execute("DELETE FROM PaymentCheck WHERE insuranceId = ?", [insuranceId]);
    if (String(body.paymentMethod || "") === "شيكات" && Array.isArray(body.checks)) {
      for (const check of body.checks) {
        if (String(check.checkNumber || "").trim() || String(check.bankName || "").trim() || numberValue(check.amount) > 0) {
          await execute(
            "INSERT INTO PaymentCheck (insuranceId, checkNumber, bankName, dueDate, amount, createdAt) VALUES (?, ?, ?, ?, ?, NOW())",
            [insuranceId, String(check.checkNumber || ""), String(check.bankName || ""), new Date(check.dueDate || new Date()), numberValue(check.amount)]
          );
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("PATCH /api/customers/[id] error:", error);
    return NextResponse.json({ error: "Failed to update subscriber", message: error?.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const insuranceId = Number(id);

    if (!Number.isFinite(insuranceId)) {
      return NextResponse.json({ error: "Invalid subscriber id" }, { status: 400 });
    }

    const insurance = await queryOne<any>("SELECT * FROM Insurance WHERE id = ? LIMIT 1", [insuranceId]);

    if (!insurance) {
      return NextResponse.json({ error: "Insurance not found" }, { status: 404 });
    }

    await execute("DELETE FROM PaymentCheck WHERE insuranceId = ?", [insuranceId]);
    await execute("DELETE FROM Document WHERE insuranceId = ?", [insuranceId]);
    await execute("DELETE FROM Insurance WHERE id = ?", [insuranceId]);

    const carInsurances = await queryOne<{ count: number }>("SELECT COUNT(*) as count FROM Insurance WHERE carId = ?", [insurance.carId]);
    const carAccidents = await queryOne<{ count: number }>("SELECT COUNT(*) as count FROM AccidentCase WHERE carId = ?", [insurance.carId]);

    if (Number(carInsurances?.count || 0) === 0 && Number(carAccidents?.count || 0) === 0) {
      await execute("DELETE FROM Car WHERE id = ?", [insurance.carId]);
    }

    const customerCars = await queryOne<{ count: number }>("SELECT COUNT(*) as count FROM Car WHERE customerId = ?", [insurance.customerId]);
    const customerInsurances = await queryOne<{ count: number }>("SELECT COUNT(*) as count FROM Insurance WHERE customerId = ?", [insurance.customerId]);
    const customerAccidents = await queryOne<{ count: number }>("SELECT COUNT(*) as count FROM AccidentCase WHERE customerId = ?", [insurance.customerId]);

    if (
      Number(customerCars?.count || 0) === 0 &&
      Number(customerInsurances?.count || 0) === 0 &&
      Number(customerAccidents?.count || 0) === 0
    ) {
      await execute("DELETE FROM Customer WHERE id = ?", [insurance.customerId]);
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("DELETE /api/customers/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete subscriber", message: error?.message }, { status: 500 });
  }
}
