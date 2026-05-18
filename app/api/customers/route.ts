import { NextResponse } from "next/server";
import { execute, query } from "@/lib/db";

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

async function getFullCustomers() {
  const customers = await query<any>("SELECT * FROM Customer ORDER BY id DESC");
  const cars = await query<any>("SELECT * FROM Car ORDER BY id DESC");
  const insurances = await query<any>("SELECT * FROM Insurance ORDER BY id DESC");
  const documents = await query<any>("SELECT * FROM Document ORDER BY id ASC");
  const checks = await query<any>("SELECT * FROM PaymentCheck ORDER BY id ASC");
  const accidents = await query<any>("SELECT * FROM AccidentCase ORDER BY id DESC");
  const updates = await query<any>("SELECT * FROM AccidentUpdate ORDER BY id ASC");

  const documentsByInsurance = new Map<number, any[]>();
  documents.forEach((doc) => {
    const key = Number(doc.insuranceId);
    documentsByInsurance.set(key, [...(documentsByInsurance.get(key) || []), doc]);
  });

  const checksByInsurance = new Map<number, any[]>();
  checks.forEach((check) => {
    const key = Number(check.insuranceId);
    checksByInsurance.set(key, [...(checksByInsurance.get(key) || []), check]);
  });

  const insurancesByCar = new Map<number, any[]>();
  insurances.forEach((insurance) => {
    const key = Number(insurance.carId);
    const fullInsurance = {
      ...insurance,
      documents: documentsByInsurance.get(Number(insurance.id)) || [],
      checks: checksByInsurance.get(Number(insurance.id)) || [],
    };

    insurancesByCar.set(key, [
      ...(insurancesByCar.get(key) || []),
      fullInsurance,
    ]);
  });

  const updatesByAccident = new Map<number, any[]>();
  updates.forEach((update) => {
    const key = Number(update.accidentCaseId);
    updatesByAccident.set(key, [
      ...(updatesByAccident.get(key) || []),
      update,
    ]);
  });

  const carsByCustomer = new Map<number, any[]>();
  cars.forEach((car) => {
    const key = Number(car.customerId);
    carsByCustomer.set(key, [
      ...(carsByCustomer.get(key) || []),
      {
        ...car,
        insurances: insurancesByCar.get(Number(car.id)) || [],
      },
    ]);
  });

  const accidentsByCustomer = new Map<number, any[]>();
  accidents.forEach((accident) => {
    const key = Number(accident.customerId);
    const car =
      cars.find((row) => Number(row.id) === Number(accident.carId)) || null;

    accidentsByCustomer.set(key, [
      ...(accidentsByCustomer.get(key) || []),
      {
        ...accident,
        car,
        updates: updatesByAccident.get(Number(accident.id)) || [],
      },
    ]);
  });

  return customers.map((customer) => ({
    ...customer,
    cars: carsByCustomer.get(Number(customer.id)) || [],
    accidents: accidentsByCustomer.get(Number(customer.id)) || [],
  }));
}

export async function GET() {
  try {
    return NextResponse.json(await getFullCustomers());
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

export async function POST(req: Request) {
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

    const existingCustomerId = Number(body.customerId || 0);
    let customerId: number;

    if (Number.isFinite(existingCustomerId) && existingCustomerId > 0) {
      customerId = existingCustomerId;

      await execute(
        "UPDATE Customer SET name = ?, phone = ? WHERE id = ?",
        [String(body.name || ""), body.phone ? String(body.phone) : null, customerId]
      );
    } else {
      const customerResult = await execute(
        "INSERT INTO Customer (name, phone, createdAt) VALUES (?, ?, NOW())",
        [String(body.name || ""), body.phone ? String(body.phone) : null]
      );

      customerId = customerResult.insertId;
    }

    const carResult = await execute(
      `
      INSERT INTO Car
      (
        customerId,
        carName,
        carNumber,
        carYear
      )
      VALUES
      (
        ?,
        ?,
        ?,
        ?
      )
      `,
      [
        customerId,
        String(body.carName || ""),
        String(body.carNumber || ""),
        String(body.carYear || ""),
      ]
    );

    const carId = carResult.insertId;

    const insuranceResult = await execute(
      `
      INSERT INTO Insurance
      (
        customerId,
        carId,
        insuranceType,
        insuranceCompany,
        startDate,
        endDate,
        status,
        paymentMethod,

        hofaaEnabled,
        hofaaPrice,

        thirdPartyEnabled,
        thirdPartyPrice,

        fullEnabled,
        fullPrice,

        totalAmount,
        paidAmount,
        cashAmount,
        visaAmount,
        checksAmount,
        remainingAmount,
        paymentStatus
      )
      VALUES
      (
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,

        ?,
        ?,

        ?,
        ?,

        ?,
        ?,

        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?
      )
      `,
      [
        customerId,
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

    const insuranceId = insuranceResult.insertId;

    for (const row of buildDocumentRows(insuranceId, body)) {
      await execute(
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
          await execute(
            `
            INSERT INTO PaymentCheck
            (
              insuranceId,
              checkNumber,
              bankName,
              dueDate,
              amount,
              createdAt
            )
            VALUES
            (
              ?,
              ?,
              ?,
              ?,
              ?,
              NOW()
            )
            `,
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

    const fullCustomer = (await getFullCustomers()).find(
      (customer) => Number(customer.id) === customerId
    );

    return NextResponse.json(fullCustomer);
  } catch (error: any) {
    console.error("POST /api/customers error:", error);

    return NextResponse.json(
      {
        error: "Failed to create customer",
        message: error?.message,
      },
      { status: 500 }
    );
  }
}