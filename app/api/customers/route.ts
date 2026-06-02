import { NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit-log";
import { execute, query, withTransaction } from "@/lib/db";
import { getCustomerGraphById, getPaginatedCustomers } from "@/lib/customers-data";
import { assertCustomerExists, OwnershipError } from "@/lib/ownership";
import { parsePaginationParams } from "@/lib/pagination";
import { isErrorResponse, requireAnyPermission, requirePermission } from "@/lib/permissions";
import { loggedRoute } from "@/lib/api-observability";

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
    addDocument("carLicense", body.documents.carLicense);
    addDocument("companionId", body.documents.companionId);

    addDocument("carImage1", body.documents.carImage1);
    addDocument("carImage2", body.documents.carImage2);
    addDocument("carImage3", body.documents.carImage3);
    addDocument("carImage4", body.documents.carImage4);
    addDocument("carImage5", body.documents.carImage5);

    addDocument("insurancePolicy1", body.documents.insurancePolicy1);
    addDocument("insurancePolicy2", body.documents.insurancePolicy2);
    addDocument("other", body.documents.other);
  }

  return rows;
}

async function handleGet(req: Request) {
  const auth = await requireAnyPermission("viewSubscribers", "viewAccounting");
  if (isErrorResponse(auth)) return auth;

  try {
    const url = new URL(req.url);
    const { page, limit, offset } = parsePaginationParams(url);
    const filter = String(url.searchParams.get("filter") || "all");
    const search = String(url.searchParams.get("q") || "");

    const result = await getPaginatedCustomers({ page, limit, offset, filter, search });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("GET /api/customers error:", error);

    return NextResponse.json(
      {
        error: "Failed to load customers",
        message: error?.message,
      },
      { status: 500 }
    );
  }
}

async function handlePost(req: Request) {
  const auth = await requirePermission("createSubscribers");
  if (isErrorResponse(auth)) return auth;
  const { user: currentUser } = auth;

  try {
    const body = await req.json();

    const hofaaPrice = numberValue(body.hofaaPrice);
    const thirdPartyPrice = numberValue(body.thirdPartyPrice);
    const fullPrice = numberValue(body.fullPrice);

    const totalAmount = numberValue(
      body.totalAmount || hofaaPrice + thirdPartyPrice + fullPrice
    );

    const cashAmount = numberValue(body.cashAmount);
    const visaAmount = numberValue(body.visaAmount);
    const checksAmount = numberValue(body.checksAmount);

    const paidAmount = cashAmount + visaAmount + checksAmount;
    const remainingAmount = Math.max(totalAmount - paidAmount, 0);
    const paymentStatus = calcPaymentStatus(totalAmount, paidAmount);

    const paymentMethods: string[] = [];
    if (cashAmount > 0) paymentMethods.push("كاش");
    if (visaAmount > 0) paymentMethods.push("فيزا");
    if (checksAmount > 0) paymentMethods.push("شيكات");

    const paymentMethod =
      paymentMethods.length > 0 ? paymentMethods.join(" + ") : "لاحقًا";

    const { customerId, insuranceId } = await withTransaction(async (tx) => {
      const existingCustomerId = Number(body.customerId || 0);
      let resolvedCustomerId: number;

      if (Number.isFinite(existingCustomerId) && existingCustomerId > 0) {
        resolvedCustomerId = existingCustomerId;
        await assertCustomerExists(resolvedCustomerId);

        await tx.execute(
          "UPDATE Customer SET name = ?, phone = ? WHERE id = ?",
          [String(body.name || ""), body.phone ? String(body.phone) : null, resolvedCustomerId]
        );
      } else {
        const customerResult = await tx.execute(
          "INSERT INTO Customer (name, phone, createdAt) VALUES (?, ?, NOW())",
          [String(body.name || ""), body.phone ? String(body.phone) : null]
        );

        resolvedCustomerId = customerResult.insertId;
      }

      const carResult = await tx.execute(
        "INSERT INTO Car (customerId, carName, carNumber, carYear) VALUES (?, ?, ?, ?)",
        [
          resolvedCustomerId,
          String(body.carName || ""),
          String(body.carNumber || ""),
          String(body.carYear || ""),
        ]
      );

      const carId = carResult.insertId;

      const insuranceResult = await tx.execute(
        `INSERT INTO Insurance (
          customerId, carId, insuranceType, insuranceCompany, startDate, endDate, status, paymentMethod,
          hofaaEnabled, hofaaPrice, thirdPartyEnabled, thirdPartyPrice, fullEnabled, fullPrice,
          totalAmount, paidAmount, cashAmount, visaAmount, checksAmount, remainingAmount, paymentStatus
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          resolvedCustomerId,
          carId,
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
        ]
      );

      const resolvedInsuranceId = insuranceResult.insertId;

      for (const row of buildDocumentRows(resolvedInsuranceId, body)) {
        await tx.execute(
          "INSERT INTO Document (insuranceId, type, fileUrl, fileName) VALUES (?, ?, ?, ?)",
          row
        );
      }

      if (Array.isArray(body.checks)) {
        for (const check of body.checks) {
          const hasCheckData =
            String(check.checkNumber || "").trim() ||
            String(check.bankName || "").trim() ||
            numberValue(check.amount) > 0;

          if (hasCheckData) {
            await tx.execute(
              `INSERT INTO PaymentCheck (insuranceId, checkNumber, bankName, dueDate, amount, createdAt)
               VALUES (?, ?, ?, ?, ?, NOW())`,
              [
                resolvedInsuranceId,
                String(check.checkNumber || ""),
                String(check.bankName || ""),
                new Date(check.dueDate || new Date()),
                numberValue(check.amount),
              ]
            );
          }
        }
      }

      return { customerId: resolvedCustomerId, insuranceId: resolvedInsuranceId };
    });

    const fullCustomer = await getCustomerGraphById(customerId);

    await writeActivityLog(
      currentUser,
      "إضافة مشترك",
      "المشتركين",
      `${String(body.name || "")} - ${String(body.carNumber || "")}`,
      insuranceId
    );

    return NextResponse.json(fullCustomer);
  } catch (error: any) {
    console.error("POST /api/customers error:", error);

    if (error instanceof OwnershipError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: "Failed to create customer",
        message: error?.message,
      },
      { status: 500 }
    );
  }
}

export const GET = loggedRoute("GET /api/customers", handleGet);
export const POST = loggedRoute("POST /api/customers", handlePost);
