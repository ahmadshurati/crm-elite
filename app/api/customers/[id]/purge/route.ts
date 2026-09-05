import { NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit-log";
import { queryOne, withTransaction } from "@/lib/db";
import { isErrorResponse, requirePermission } from "@/lib/permissions";
import { requireCompanyId } from "@/lib/tenant";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Permanently deletes an ARCHIVED customer and all of its related data.
 * Guardrails:
 *  - requires the deleteSubscribers permission
 *  - customer must belong to the caller's company
 *  - customer must already be archived (soft-deleted) — prevents accidental
 *    hard-deletion of an active customer.
 * Children are removed explicitly in FK-safe order inside a transaction.
 */
async function handleDelete(_req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("deleteSubscribers");
  if (isErrorResponse(auth)) return auth;
  const companyId = requireCompanyId(auth.user);

  try {
    const { id } = await context.params;
    const customerId = Number(id);
    if (!Number.isFinite(customerId) || customerId <= 0) {
      return NextResponse.json({ error: "معرّف غير صالح" }, { status: 400 });
    }

    const customer = await queryOne<{ id: number; name: string; isArchived: number | boolean }>(
      "SELECT id, name, isArchived FROM Customer WHERE id = ? AND companyId = ? LIMIT 1",
      [customerId, companyId]
    );

    if (!customer) {
      return NextResponse.json({ error: "العميل غير موجود" }, { status: 404 });
    }
    if (!customer.isArchived) {
      return NextResponse.json(
        { error: "الحذف النهائي متاح فقط للعملاء المؤرشفين. الرجاء أرشفة العميل أولًا." },
        { status: 409 }
      );
    }

    await withTransaction(async (tx) => {
      const insurances = await tx.query<{ id: number }>(
        "SELECT id FROM Insurance WHERE customerId = ?",
        [customerId]
      );
      const insuranceIds = insurances.map((r) => Number(r.id));

      const accidents = await tx.query<{ id: number }>(
        "SELECT id FROM AccidentCase WHERE customerId = ?",
        [customerId]
      );
      const accidentIds = accidents.map((r) => Number(r.id));

      // Insurance children first (Document / PaymentCheck -> Insurance).
      if (insuranceIds.length > 0) {
        const ph = insuranceIds.map(() => "?").join(", ");
        await tx.execute(`DELETE FROM Document WHERE insuranceId IN (${ph})`, insuranceIds);
        await tx.execute(`DELETE FROM PaymentCheck WHERE insuranceId IN (${ph})`, insuranceIds);
      }
      await tx.execute("DELETE FROM Insurance WHERE customerId = ?", [customerId]);

      // Accidents reference Car(carId), so remove them before Car.
      if (accidentIds.length > 0) {
        const ph = accidentIds.map(() => "?").join(", ");
        await tx.execute(`DELETE FROM AccidentUpdate WHERE accidentCaseId IN (${ph})`, accidentIds);
      }
      await tx.execute("DELETE FROM AccidentCase WHERE customerId = ?", [customerId]);

      await tx.execute("DELETE FROM Car WHERE customerId = ?", [customerId]);

      // Other CRM records linked to the customer.
      await tx.execute("DELETE FROM CustomerCommunication WHERE customerId = ?", [customerId]);
      await tx.execute("DELETE FROM Invoice WHERE customerId = ?", [customerId]);
      await tx.execute("DELETE FROM Quote WHERE customerId = ?", [customerId]);
      await tx.execute("DELETE FROM Contract WHERE customerId = ?", [customerId]);
      await tx.execute("DELETE FROM Deal WHERE customerId = ?", [customerId]);

      // Detach records we keep (tasks / files / messages) instead of deleting them.
      await tx.execute("UPDATE CrmTask SET customerId = NULL WHERE customerId = ?", [customerId]);
      await tx.execute("UPDATE CrmFile SET customerId = NULL WHERE customerId = ?", [customerId]);
      await tx.execute("UPDATE OutboundMessage SET customerId = NULL WHERE customerId = ?", [customerId]);
      await tx.execute("UPDATE InboundMessage SET customerId = NULL WHERE customerId = ?", [customerId]);

      await tx.execute(
        "DELETE FROM Customer WHERE id = ? AND companyId = ? AND isArchived = true",
        [customerId, companyId]
      );
    });

    await writeActivityLog(
      auth.user,
      "حذف نهائي لعميل مؤرشف",
      "المشتركين",
      `${customer.name} (#${customerId})`,
      customerId
    );

    return NextResponse.json({ ok: true, deletedCustomerId: customerId });
  } catch (error: unknown) {
    console.error("DELETE /api/customers/[id]/purge error:", error);
    return NextResponse.json({ error: "تعذّر الحذف النهائي" }, { status: 500 });
  }
}

export const DELETE = loggedRoute("DELETE /api/customers/[id]/purge", handleDelete);
