import { NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit-log";
import { logFieldChanges } from "@/lib/field-audit";
import { getCustomerGraphById } from "@/lib/customers-data";
import { queryOne, withTransaction, execute } from "@/lib/db";
import {
  assertCustomerExists,
  assertInsuranceBelongsToCustomer,
  assertInsuranceCarLink,
  OwnershipError,
} from "@/lib/ownership";
import { isErrorResponse, requirePermission } from "@/lib/permissions";
import { requireCompanyId } from "@/lib/tenant";
import { loggedRoute } from "@/lib/api-observability";
import {
  customerProfileSqlValues,
  customerProfileUpdateClause,
  readCustomerProfileFromBody,
} from "@/lib/crm/customer-profile";

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

  if (body.documents) {
    addDocument("drivingLicense", body.documents.drivingLicense);
    addDocument("carLicense", body.documents.carLicense);
    addDocument("companionId", body.documents.companionId);
    addDocument("carImage1", body.documents.carImage1);
    addDocument("carImage2", body.documents.carImage2);
    addDocument("carImage3", body.documents.carImage3);
    addDocument("carImage4", body.documents.carImage4);
    addDocument("carImage5", body.documents.carImage5);
    addDocument("insurancePolicy1", body.documents.insurancePolicy1);
    addDocument("insurancePolicy2", body.documents.insurancePolicy2);
    addDocument("otherDocument", body.documents.otherDocument);
    addDocument("otherDocument2", body.documents.otherDocument2);
    addDocument("otherDocument3", body.documents.otherDocument3);
  }

  return rows;
}

function buildPaymentMethod(cashAmount: number, visaAmount: number, checksAmount: number) {
  const paymentMethods: string[] = [];
  if (cashAmount > 0) paymentMethods.push("كاش");
  if (visaAmount > 0) paymentMethods.push("فيزا");
  if (checksAmount > 0) paymentMethods.push("شيكات");
  return paymentMethods.length > 0 ? paymentMethods.join(" + ") : "لاحقًا";
}

async function handlePatch(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission("editSubscribers");
  if (isErrorResponse(auth)) return auth;
  const { user: currentUser } = auth;
  const companyId = requireCompanyId(currentUser);

  try {
    const body = await req.json();
    const { id } = await context.params;
    const customerId = Number(id);

    await assertCustomerExists(customerId, companyId);

    const carId = Number(body.carId);
    const insuranceId = Number(body.insuranceId);

    if (body.action === "archive") {
      await execute("UPDATE Customer SET isArchived = true, archivedAt = NOW() WHERE id = ?", [customerId]);
      await writeActivityLog(currentUser, "أرشفة عميل", "المشتركين", String(customerId), customerId);
      return NextResponse.json({ ok: true, isArchived: true });
    }

    if (body.action === "restore") {
      await execute("UPDATE Customer SET isArchived = false, archivedAt = NULL WHERE id = ?", [customerId]);
      await writeActivityLog(currentUser, "استعادة عميل", "المشتركين", String(customerId), customerId);
      return NextResponse.json({ ok: true, isArchived: false });
    }

    if (body.action === "terminate") {
      if (!Number.isFinite(insuranceId) || insuranceId <= 0) {
        return NextResponse.json({ error: "Missing insuranceId" }, { status: 400 });
      }

      await assertInsuranceBelongsToCustomer(insuranceId, customerId);

      await withTransaction(async (tx) => {
        await tx.execute(
          "UPDATE Insurance SET status = 'منتهي' WHERE id = ? AND customerId = ?",
          [insuranceId, customerId]
        );
      });

      await writeActivityLog(
        currentUser,
        "إنهاء اشتراك",
        "المشتركين",
        String(body.details || insuranceId),
        insuranceId
      );

      const terminatedCustomer = await getCustomerGraphById(customerId, companyId);
      return NextResponse.json(terminatedCustomer);
    }

    if (!Number.isFinite(carId) || carId <= 0 || !Number.isFinite(insuranceId) || insuranceId <= 0) {
      return NextResponse.json({ error: "Missing carId or insuranceId" }, { status: 400 });
    }

    await assertInsuranceCarLink(insuranceId, carId, customerId);

    const hofaaPrice = numberValue(body.hofaaPrice);
    const thirdPartyPrice = numberValue(body.thirdPartyPrice);
    const fullPrice = numberValue(body.fullPrice);
    const totalAmount = numberValue(body.totalAmount || hofaaPrice + thirdPartyPrice + fullPrice);
    const cashAmount = numberValue(body.cashAmount);
    const visaAmount = numberValue(body.visaAmount);
    const checksAmount = numberValue(body.checksAmount);
    const paidAmount = cashAmount + visaAmount + checksAmount;
    const remainingAmount = Math.max(totalAmount - paidAmount, 0);
    const paymentStatus = calcPaymentStatus(totalAmount, paidAmount);
    const paymentMethod = buildPaymentMethod(cashAmount, visaAmount, checksAmount);

    const beforeCustomer = await queryOne<Record<string, unknown>>(
      "SELECT name, phone, email, address, city, country, customerStatus, source, tags, notes FROM Customer WHERE id = ? LIMIT 1",
      [customerId]
    );

    await withTransaction(async (tx) => {
      await tx.execute(`UPDATE Customer SET name=?, phone=?, ${customerProfileUpdateClause()} WHERE id=?`, [
        String(body.name || ""),
        body.phone || null,
        ...customerProfileSqlValues(readCustomerProfileFromBody(body)),
        customerId,
      ]);

      await tx.execute(
        "UPDATE Car SET carName=?, carNumber=?, carYear=? WHERE id=? AND customerId=?",
        [
          String(body.carName || ""),
          String(body.carNumber || ""),
          String(body.carYear || ""),
          carId,
          customerId,
        ]
      );

      await tx.execute(
        `UPDATE Insurance SET
          insuranceType=?, insuranceCompany=?, startDate=?, endDate=?, status=?, paymentMethod=?,
          hofaaEnabled=?, hofaaPrice=?, thirdPartyEnabled=?, thirdPartyPrice=?, fullEnabled=?, fullPrice=?,
          totalAmount=?, paidAmount=?, cashAmount=?, visaAmount=?, checksAmount=?, remainingAmount=?, paymentStatus=?
         WHERE id=? AND customerId=? AND carId=?`,
        [
          String(body.insuranceType || ""),
          String(body.insuranceCompany || ""),
          new Date(body.startDate),
          new Date(body.endDate),
          String(body.status || "فعال"),
          paymentMethod,
          body.hofaaEnabled ? 1 : 0,
          hofaaPrice,
          body.thirdPartyEnabled ? 1 : 0,
          thirdPartyPrice,
          body.fullEnabled ? 1 : 0,
          fullPrice,
          totalAmount,
          paidAmount,
          cashAmount,
          visaAmount,
          checksAmount,
          remainingAmount,
          paymentStatus,
          insuranceId,
          customerId,
          carId,
        ]
      );

      await tx.execute("DELETE FROM Document WHERE insuranceId=?", [insuranceId]);

      for (const row of buildDocumentRows(insuranceId, body)) {
        await tx.execute(
          "INSERT INTO Document (insuranceId, type, fileUrl, fileName) VALUES (?, ?, ?, ?)",
          row
        );
      }

      await tx.execute("DELETE FROM PaymentCheck WHERE insuranceId=?", [insuranceId]);

      if (Array.isArray(body.checks)) {
        for (const check of body.checks) {
          if (
            String(check.checkNumber || "").trim() ||
            String(check.bankName || "").trim() ||
            numberValue(check.amount) > 0
          ) {
            await tx.execute(
              `INSERT INTO PaymentCheck (insuranceId, checkNumber, bankName, dueDate, amount, createdAt)
               VALUES (?, ?, ?, ?, ?, NOW())`,
              [
                insuranceId,
                String(check.checkNumber || ""),
                String(check.bankName || ""),
                new Date(check.dueDate || new Date()),
                numberValue(check.amount),
              ]
            );
          }
        }
      }
    });

    const profileAfter = readCustomerProfileFromBody(body);
    await logFieldChanges({
      user: currentUser,
      module: "المشتركين",
      entityType: "Customer",
      entityId: customerId,
      before: beforeCustomer || {},
      after: {
        name: String(body.name || ""),
        phone: body.phone ?? null,
        ...profileAfter,
      },
      fields: ["name", "phone", "email", "address", "city", "country", "customerStatus", "source", "tags", "notes"],
    });

    await writeActivityLog(
      currentUser,
      "تعديل مشترك",
      "المشتركين",
      `${String(body.name || "")} - ${String(body.carNumber || "")}`,
      insuranceId
    );

    const updatedCustomer = await getCustomerGraphById(customerId, companyId);
    return NextResponse.json(updatedCustomer);
  } catch (error: any) {
    console.error(error);

    if (error instanceof OwnershipError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

async function handleDelete(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission("deleteSubscribers");
  if (isErrorResponse(auth)) return auth;
  const { user: currentUser } = auth;
  const companyId = requireCompanyId(currentUser);

  try {
    const { id } = await context.params;
    const insuranceId = Number(id);

    if (!Number.isFinite(insuranceId) || insuranceId <= 0) {
      return NextResponse.json({ error: "Invalid insuranceId" }, { status: 400 });
    }

    const insurance = await queryOne<any>(
      `SELECT i.id, i.customerId, c.name AS customerName, car.carNumber
       FROM Insurance i
       JOIN Customer c ON c.id = i.customerId
       JOIN Car car ON car.id = i.carId
       WHERE i.id = ? AND c.companyId = ? LIMIT 1`,
      [insuranceId, companyId]
    );

    if (!insurance) {
      return NextResponse.json({ error: "Insurance not found" }, { status: 404 });
    }

    await withTransaction(async (tx) => {
      await tx.execute("DELETE FROM Document WHERE insuranceId = ?", [insuranceId]);
      await tx.execute("DELETE FROM PaymentCheck WHERE insuranceId = ?", [insuranceId]);
      await tx.execute("DELETE FROM Insurance WHERE id = ?", [insuranceId]);
    });

    await writeActivityLog(
      currentUser,
      "حذف مشترك",
      "المشتركين",
      `${insurance.customerName} - ${insurance.carNumber}`,
      insuranceId
    );

    return NextResponse.json({ ok: true, deletedInsuranceId: insuranceId });
  } catch (error: any) {
    console.error("DELETE SUBSCRIBER ERROR:", error);

    return NextResponse.json(
      { error: "Delete failed", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}

export const PATCH = loggedRoute("PATCH /api/customers/[id]", handlePatch);
export const DELETE = loggedRoute("DELETE /api/customers/[id]", handleDelete);
