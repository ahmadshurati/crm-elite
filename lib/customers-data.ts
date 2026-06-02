import { execute, query, queryOne } from "@/lib/db";
import { buildPaginationMeta, type PaginationMeta } from "@/lib/pagination";

export type CustomerStats = {
  activePolicies: number;
  activeCustomers: number;
  totalCustomers: number;
  openAccidents: number;
  renewalsThisMonth: number;
};

export type PaginatedCustomersResult = {
  items: any[];
  pagination: PaginationMeta;
  stats: CustomerStats;
};

async function expireInsurances() {
  await execute(
    "UPDATE Insurance SET status = 'منتهي' WHERE endDate < CURDATE() AND status NOT IN ('منتهي', 'غير فعال')",
    []
  );
}

function buildInsuranceFilterClause(filter: string) {
  switch (filter) {
    case "active":
      return "(i.status IN ('فعال', 'جديد') AND i.endDate >= CURDATE())";
    case "inactive":
      return "(i.status IN ('غير فعال', 'منتهي') OR i.endDate < CURDATE())";
    case "renewals-this-month":
      return "i.status = 'فعال' AND MONTH(i.endDate) = MONTH(CURDATE()) AND YEAR(i.endDate) = YEAR(CURDATE())";
    default:
      return "1=1";
  }
}

function buildSearchClause(search: string) {
  const term = search.trim();
  if (!term) {
    return { clause: "", params: [] as string[] };
  }

  const like = `%${term}%`;
  return {
    clause: ` AND (
      c.name LIKE ? OR
      IFNULL(c.phone, '') LIKE ? OR
      car.carName LIKE ? OR
      car.carNumber LIKE ? OR
      IFNULL(car.carYear, '') LIKE ? OR
      i.insuranceType LIKE ? OR
      i.insuranceCompany LIKE ?
    )`,
    params: [like, like, like, like, like, like, like],
  };
}

async function getCustomerStats(): Promise<CustomerStats> {
  const [activePolicies, activeCustomers, totalCustomers, openAccidents, renewalsThisMonth] =
    await Promise.all([
      queryOne<{ count: number }>(
        "SELECT COUNT(*) as count FROM Insurance WHERE status IN ('فعال', 'جديد') AND endDate >= CURDATE()"
      ),
      queryOne<{ count: number }>(
        "SELECT COUNT(DISTINCT customerId) as count FROM Insurance WHERE status IN ('فعال', 'جديد') AND endDate >= CURDATE()"
      ),
      queryOne<{ count: number }>("SELECT COUNT(*) as count FROM Customer"),
      queryOne<{ count: number }>("SELECT COUNT(*) as count FROM AccidentCase WHERE status = 'مفتوح'"),
      queryOne<{ count: number }>(
        `SELECT COUNT(*) as count
         FROM Insurance i
         WHERE i.status = 'فعال'
           AND MONTH(i.endDate) = MONTH(CURDATE())
           AND YEAR(i.endDate) = YEAR(CURDATE())
           AND NOT EXISTS (
             SELECT 1
             FROM Insurance newer
             WHERE newer.customerId = i.customerId
               AND newer.id <> i.id
               AND newer.status = 'فعال'
               AND newer.endDate > i.endDate
           )`
      ),
    ]);

  return {
    activePolicies: Number(activePolicies?.count || 0),
    activeCustomers: Number(activeCustomers?.count || 0),
    totalCustomers: Number(totalCustomers?.count || 0),
    openAccidents: Number(openAccidents?.count || 0),
    renewalsThisMonth: Number(renewalsThisMonth?.count || 0),
  };
}

async function assembleCustomersFromInsuranceIds(insuranceIds: number[]) {
  if (insuranceIds.length === 0) {
    return [];
  }

  const placeholders = insuranceIds.map(() => "?").join(", ");

  const insurances = await query<any>(
    `SELECT i.* FROM Insurance i WHERE i.id IN (${placeholders}) ORDER BY i.id DESC`,
    insuranceIds
  );

  const carIds = [...new Set(insurances.map((row) => Number(row.carId)))];
  const customerIds = [...new Set(insurances.map((row) => Number(row.customerId)))];

  if (carIds.length === 0 || customerIds.length === 0) {
    return [];
  }

  const carPlaceholders = carIds.map(() => "?").join(", ");
  const customerPlaceholders = customerIds.map(() => "?").join(", ");

  const [cars, customers, documents, checks, accidents, updates] = await Promise.all([
    query<any>(`SELECT * FROM Car WHERE id IN (${carPlaceholders})`, carIds),
    query<any>(`SELECT * FROM Customer WHERE id IN (${customerPlaceholders})`, customerIds),
    query<any>(`SELECT * FROM Document WHERE insuranceId IN (${placeholders}) ORDER BY id ASC`, insuranceIds),
    query<any>(`SELECT * FROM PaymentCheck WHERE insuranceId IN (${placeholders}) ORDER BY id ASC`, insuranceIds),
    query<any>(
      `SELECT * FROM AccidentCase WHERE customerId IN (${customerPlaceholders}) ORDER BY id DESC`,
      customerIds
    ),
    query<any>(
      `SELECT au.* FROM AccidentUpdate au
       INNER JOIN AccidentCase ac ON ac.id = au.accidentCaseId
       WHERE ac.customerId IN (${customerPlaceholders})
       ORDER BY au.id ASC`,
      customerIds
    ),
  ]);

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

    insurancesByCar.set(key, [...(insurancesByCar.get(key) || []), fullInsurance]);
  });

  const updatesByAccident = new Map<number, any[]>();
  updates.forEach((update) => {
    const key = Number(update.accidentCaseId);
    updatesByAccident.set(key, [...(updatesByAccident.get(key) || []), update]);
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
    const car = cars.find((row) => Number(row.id) === Number(accident.carId)) || null;

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

export async function getPaginatedCustomers(options: {
  page: number;
  limit: number;
  offset: number;
  filter?: string;
  search?: string;
}): Promise<PaginatedCustomersResult> {
  await expireInsurances();

  const filter = options.filter || "all";
  const search = buildSearchClause(options.search || "");
  const whereClause = `${buildInsuranceFilterClause(filter)}${search.clause}`;

  const totalRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) as total
     FROM Insurance i
     INNER JOIN Car car ON car.id = i.carId
     INNER JOIN Customer c ON c.id = i.customerId
     WHERE ${whereClause}`,
    search.params
  );

  const total = Number(totalRow?.total || 0);

  const insuranceRows = await query<{ id: number }>(
    `SELECT i.id
     FROM Insurance i
     INNER JOIN Car car ON car.id = i.carId
     INNER JOIN Customer c ON c.id = i.customerId
     WHERE ${whereClause}
     ORDER BY i.id DESC
     LIMIT ? OFFSET ?`,
    [...search.params, options.limit, options.offset]
  );

  const stats = await getCustomerStats();
  const items = await assembleCustomersFromInsuranceIds(insuranceRows.map((row) => Number(row.id)));

  return {
    items,
    pagination: buildPaginationMeta(options.page, options.limit, total),
    stats,
  };
}

export async function getCustomerGraphById(customerId: number) {
  await expireInsurances();

  const insuranceRows = await query<{ id: number }>(
    "SELECT id FROM Insurance WHERE customerId = ? ORDER BY id DESC",
    [customerId]
  );

  const graphs = await assembleCustomersFromInsuranceIds(insuranceRows.map((row) => Number(row.id)));
  return graphs.find((customer) => Number(customer.id) === customerId) || null;
}
