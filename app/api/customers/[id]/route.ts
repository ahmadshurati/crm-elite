import { NextResponse } from "next/server";
import { execute, queryOne } from "@/lib/db";
import { isErrorResponse, requirePermission } from "@/lib/permissions";

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

    rows.push([
      insuranceId,
      type,
      url,
      fileNameFromUrl(url),
    ]);
  };

  addDocument("policyImage", body.policyImage);

  if (body.documents) {
    addDocument("drivingLicense", body.documents.drivingLicense);

    addDocument(
      "carLicense",
      body.documents.carLicense
    );

    addDocument(
      "companionId",
      body.documents.companionId
    );

    addDocument(
      "carImage1",
      body.documents.carImage1
    );

    addDocument(
      "carImage2",
      body.documents.carImage2
    );

    addDocument(
      "carImage3",
      body.documents.carImage3
    );

    addDocument(
      "carImage4",
      body.documents.carImage4
    );

    addDocument(
      "carImage5",
      body.documents.carImage5
    );

    addDocument(
      "insurancePolicy1",
      body.documents.insurancePolicy1
    );

    addDocument(
      "insurancePolicy2",
      body.documents.insurancePolicy2
    );

    addDocument(
      "other",
      body.documents.other
    );
  }

  return rows;
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const body = await req.json();
    const auth = await requirePermission("editSubscribers");
    if (isErrorResponse(auth)) return auth;

    const { id } = await context.params;

    const customerId = Number(id);

    const carId = Number(body.carId);

    const insuranceId = Number(
      body.insuranceId
    );

    if (body.action === "terminate") {
      if (!Number.isFinite(insuranceId) || insuranceId <= 0) {
        return NextResponse.json(
          { error: "Missing insuranceId" },
          { status: 400 }
        );
      }

      await execute(
        "UPDATE Insurance SET status = 'منتهي' WHERE id = ? AND customerId = ?",
        [insuranceId, customerId]
      );

      return NextResponse.json({
        ok: true,
        action: "terminate",
        insuranceId,
      });
    }

    const hofaaPrice = numberValue(
      body.hofaaPrice
    );

    const thirdPartyPrice = numberValue(
      body.thirdPartyPrice
    );

    const fullPrice = numberValue(
      body.fullPrice
    );

    const totalAmount = numberValue(
      body.totalAmount ||
      hofaaPrice +
      thirdPartyPrice +
      fullPrice
    );

    const cashAmount = numberValue(
      body.cashAmount
    );

    const visaAmount = numberValue(
      body.visaAmount
    );

    const checksAmount = numberValue(
      body.checksAmount
    );

    const paidAmount =
      cashAmount +
      visaAmount +
      checksAmount;

    const remainingAmount =
      Math.max(
        totalAmount -
        paidAmount,
        0
      );

    const paymentStatus =
      calcPaymentStatus(
        totalAmount,
        paidAmount
      );

    const paymentMethods = [];

    if (cashAmount > 0)
      paymentMethods.push("كاش");

    if (visaAmount > 0)
      paymentMethods.push("فيزا");

    if (checksAmount > 0)
      paymentMethods.push("شيكات");

    const paymentMethod =
      paymentMethods.join(" + ");

    await execute(
      "UPDATE Customer SET name=?, phone=? WHERE id=?",
      [
        String(body.name || ""),
        body.phone || null,
        customerId
      ]
    );

    await execute(
      `
      UPDATE Car
      SET
      carName=?,
      carNumber=?,
      carYear=?
      WHERE id=?
      `,
      [
        String(body.carName || ""),
        String(body.carNumber || ""),
        String(body.carYear || ""),
        carId
      ]
    );

    await execute(
`
UPDATE Insurance
SET

insuranceType=?,
insuranceCompany=?,

startDate=?,
endDate=?,

status=?,
paymentMethod=?,

hofaaEnabled=?,
hofaaPrice=?,

thirdPartyEnabled=?,
thirdPartyPrice=?,

fullEnabled=?,
fullPrice=?,

totalAmount=?,
paidAmount=?,

cashAmount=?,
visaAmount=?,
checksAmount=?,

remainingAmount=?,
paymentStatus=?

WHERE id=?
`,
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

insuranceId
]
);

    await execute(
      "DELETE FROM Document WHERE insuranceId=?",
      [insuranceId]
    );

    for (const row of buildDocumentRows(
      insuranceId,
      body
    )) {

      await execute(
        `
INSERT INTO Document
(
insuranceId,
type,
fileUrl,
fileName
)
VALUES
(
?,
?,
?,
?
)
`,
row
);

    }

    await execute(
      "DELETE FROM PaymentCheck WHERE insuranceId=?",
      [insuranceId]
    );

    if (Array.isArray(body.checks)) {

      for (const check of body.checks) {

        if (
String(check.checkNumber || "").trim() ||
String(check.bankName || "").trim() ||
numberValue(check.amount) > 0
) {

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
numberValue(check.amount)
]
);

}

      }

    }

    return NextResponse.json({
      ok: true
    });

  } catch (error: any) {

console.error(error);

return NextResponse.json(
{
error: "Failed"
},
{
status: 500
}
);

  }
}

/**
 * مهم:
 * الواجهة تستدعي الحذف هكذا:
 * fetch(`/api/customers/${subscriber.id}`, { method: "DELETE" })
 *
 * subscriber.id هنا هو Insurance.id وليس Customer.id.
 * لذلك هذا الحذف يحذف التأمين فقط مع مستنداته وشيكاته.
 * لا يحذف الزبون ولا سجله ولا السيارات ولا الحوادث.
 */
export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission("deleteSubscribers");
  if (isErrorResponse(auth)) return auth;

  try {
    const { id } = await context.params;

    const insuranceId = Number(id);

    if (!Number.isFinite(insuranceId) || insuranceId <= 0) {
      return NextResponse.json(
        { error: "Invalid insuranceId" },
        { status: 400 }
      );
    }

    await execute(
      "DELETE FROM Document WHERE insuranceId = ?",
      [insuranceId]
    );

    await execute(
      "DELETE FROM PaymentCheck WHERE insuranceId = ?",
      [insuranceId]
    );

    await execute(
      "DELETE FROM Insurance WHERE id = ?",
      [insuranceId]
    );

    return NextResponse.json({
      ok: true,
      deletedInsuranceId: insuranceId,
    });

  } catch (error: any) {
    console.error("DELETE SUBSCRIBER ERROR:", error);

    return NextResponse.json(
      {
        error: "Delete failed",
        details: error?.message || String(error),
      },
      {
        status: 500
      }
    );
  }
}
