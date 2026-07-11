import { describe, expect, it } from "vitest";
import { parseCustomerImportCsv } from "@/lib/crm/csv-import";

describe("csv import", () => {
  it("parses rows with english headers", () => {
    const csv = `name,phone,carName,carNumber,insuranceCompany,insuranceType,startDate,endDate
Test User,0599000000,Toyota,12-345-67,Company A,Full,2026-01-01,2027-01-01`;

    const result = parseCustomerImportCsv(csv);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].name).toBe("Test User");
    expect(result.rows[0].carNumber).toBe("12-345-67");
  });

  it("rejects rows without name", () => {
    const csv = `name,phone
,0599000000`;

    const result = parseCustomerImportCsv(csv);
    expect(result.rows).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
