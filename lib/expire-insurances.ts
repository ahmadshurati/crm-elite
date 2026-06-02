import { execute } from "@/lib/db";

export async function expireInsurances() {
  const result = await execute(
    "UPDATE Insurance SET status = 'منتهي' WHERE endDate < CURDATE() AND status NOT IN ('منتهي', 'غير فعال')",
    []
  );

  return result.affectedRows ?? 0;
}
