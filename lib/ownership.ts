import { queryOne } from "@/lib/db";

export class OwnershipError extends Error {
  constructor(message = "Resource does not belong to the specified customer") {
    super(message);
    this.name = "OwnershipError";
  }
}

export async function assertCustomerExists(customerId: number, companyId?: number | null) {
  const customer = companyId
    ? await queryOne<{ id: number }>(
        "SELECT id FROM Customer WHERE id = ? AND companyId = ? LIMIT 1",
        [customerId, companyId]
      )
    : await queryOne<{ id: number }>("SELECT id FROM Customer WHERE id = ? LIMIT 1", [customerId]);

  if (!customer) {
    throw new OwnershipError(companyId ? "Customer not found in your company" : "Customer not found");
  }
}

export async function assertCarBelongsToCustomer(carId: number, customerId: number) {
  const car = await queryOne<{ id: number }>(
    "SELECT id FROM Car WHERE id = ? AND customerId = ? LIMIT 1",
    [carId, customerId]
  );

  if (!car) {
    throw new OwnershipError("Car does not belong to customer");
  }
}

export async function assertInsuranceBelongsToCustomer(insuranceId: number, customerId: number) {
  const insurance = await queryOne<{ id: number }>(
    "SELECT id FROM Insurance WHERE id = ? AND customerId = ? LIMIT 1",
    [insuranceId, customerId]
  );

  if (!insurance) {
    throw new OwnershipError("Insurance does not belong to customer");
  }
}

export async function assertInsuranceCarLink(insuranceId: number, carId: number, customerId: number) {
  await assertInsuranceBelongsToCustomer(insuranceId, customerId);
  await assertCarBelongsToCustomer(carId, customerId);

  const insurance = await queryOne<{ id: number }>(
    "SELECT id FROM Insurance WHERE id = ? AND carId = ? AND customerId = ? LIMIT 1",
    [insuranceId, carId, customerId]
  );

  if (!insurance) {
    throw new OwnershipError("Insurance does not belong to the specified car");
  }
}
