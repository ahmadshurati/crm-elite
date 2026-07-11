import { query, queryOne } from "@/lib/db";
import { buildPaginationMeta, type PaginationMeta } from "@/lib/pagination";
import { customerCompanyClause } from "@/lib/tenant";

export type AccidentStats = {
  total: number;
  openCount: number;
};

export type PaginatedAccidentsResult = {
  items: any[];
  pagination: PaginationMeta;
  stats: AccidentStats;
};

function buildAccidentFilterClause(filter: string) {
  switch (filter) {
    case "open":
      return "ac.status = 'مفتوح'";
    case "closed":
      return "ac.status = 'مغلق'";
    default:
      return "1=1";
  }
}

function buildAccidentSearchClause(search: string) {
  const term = search.trim();
  if (!term) {
    return { clause: "", params: [] as string[] };
  }

  const like = `%${term}%`;
  return {
    clause: ` AND (
      ac.caseNumber LIKE ? OR
      ac.details LIKE ? OR
      IFNULL(c.name, '') LIKE ? OR
      IFNULL(c.phone, '') LIKE ? OR
      IFNULL(car.carName, '') LIKE ? OR
      IFNULL(car.carNumber, '') LIKE ?
    )`,
    params: [like, like, like, like, like, like],
  };
}

async function getAccidentStats(companyId?: number | null): Promise<AccidentStats> {
  const tenant = customerCompanyClause("c", companyId);
  const [total, openCount] = await Promise.all([
    queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM AccidentCase ac INNER JOIN Customer c ON c.id = ac.customerId WHERE 1=1${tenant.clause}`,
      tenant.params
    ),
    queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM AccidentCase ac INNER JOIN Customer c ON c.id = ac.customerId WHERE ac.status = 'مفتوح'${tenant.clause}`,
      tenant.params
    ),
  ]);

  return {
    total: Number(total?.count || 0),
    openCount: Number(openCount?.count || 0),
  };
}

async function assembleAccidents(accidentIds: number[]) {
  if (accidentIds.length === 0) {
    return [];
  }

  const placeholders = accidentIds.map(() => "?").join(", ");

  const accidents = await query<any>(
    `SELECT ac.* FROM AccidentCase ac WHERE ac.id IN (${placeholders}) ORDER BY ac.id DESC`,
    accidentIds
  );

  const customerIds = [...new Set(accidents.map((row) => Number(row.customerId)))];
  const carIds = [...new Set(accidents.map((row) => Number(row.carId)))];

  const customerPlaceholders = customerIds.map(() => "?").join(", ");
  const carPlaceholders = carIds.map(() => "?").join(", ");

  const [customers, cars, updates] = await Promise.all([
    customerIds.length
      ? query<any>(`SELECT * FROM Customer WHERE id IN (${customerPlaceholders})`, customerIds)
      : Promise.resolve([]),
    carIds.length ? query<any>(`SELECT * FROM Car WHERE id IN (${carPlaceholders})`, carIds) : Promise.resolve([]),
    query<any>(
      `SELECT * FROM AccidentUpdate WHERE accidentCaseId IN (${placeholders}) ORDER BY id ASC`,
      accidentIds
    ),
  ]);

  return accidents.map((accident) => ({
    ...accident,
    customer: customers.find((customer) => Number(customer.id) === Number(accident.customerId)) || null,
    car: cars.find((car) => Number(car.id) === Number(accident.carId)) || null,
    updates: updates.filter((update) => Number(update.accidentCaseId) === Number(accident.id)),
  }));
}

export async function getPaginatedAccidents(options: {
  page: number;
  limit: number;
  offset: number;
  filter?: string;
  search?: string;
  companyId?: number | null;
}): Promise<PaginatedAccidentsResult> {
  const filter = options.filter || "all";
  const search = buildAccidentSearchClause(options.search || "");
  const tenant = customerCompanyClause("c", options.companyId);
  const whereClause = `${buildAccidentFilterClause(filter)}${search.clause}${tenant.clause}`;
  const params = [...search.params, ...tenant.params];

  const totalRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) as total
     FROM AccidentCase ac
     LEFT JOIN Customer c ON c.id = ac.customerId
     LEFT JOIN Car car ON car.id = ac.carId
     WHERE ${whereClause}`,
    params
  );

  const total = Number(totalRow?.total || 0);

  const accidentRows = await query<{ id: number }>(
    `SELECT ac.id
     FROM AccidentCase ac
     LEFT JOIN Customer c ON c.id = ac.customerId
     LEFT JOIN Car car ON car.id = ac.carId
     WHERE ${whereClause}
     ORDER BY ac.id DESC
     LIMIT ? OFFSET ?`,
    [...params, options.limit, options.offset]
  );

  const stats = await getAccidentStats(options.companyId);
  const items = await assembleAccidents(accidentRows.map((row) => Number(row.id)));

  return {
    items,
    pagination: buildPaginationMeta(options.page, options.limit, total),
    stats,
  };
}

export async function getAccidentById(id: number) {
  const items = await assembleAccidents([id]);
  return items[0] || null;
}
