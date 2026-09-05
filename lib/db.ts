import mysql from "mysql2/promise";
import type { Pool, PoolConnection, ResultSetHeader } from "mysql2/promise";

const globalForDb = globalThis as unknown as {
  mysqlPool?: Pool;
};

function getDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is missing");
  }
  return url;
}

function getPoolLimit() {
  const raw = Number(process.env.DATABASE_POOL_LIMIT || 3);
  return Number.isFinite(raw) && raw > 0 ? raw : 3;
}

// Errors where the connection was lost/refused — safe to retry a READ because
// the query never completed. (The hourly-connection-cap error is intentionally
// NOT here: retrying it cannot help.)
const TRANSIENT_DB_ERROR_CODES = new Set([
  "PROTOCOL_CONNECTION_LOST",
  "ECONNRESET",
  "ETIMEDOUT",
  "EPIPE",
  "ECONNREFUSED",
  "PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR",
]);

function isTransientDbError(error: unknown): boolean {
  const code = (error as { code?: unknown })?.code;
  return typeof code === "string" && TRANSIENT_DB_ERROR_CODES.has(code);
}

function getQueueLimit() {
  const raw = Number(process.env.DATABASE_QUEUE_LIMIT ?? 0);
  return Number.isFinite(raw) && raw >= 0 ? raw : 0;
}

export function getPool() {
  if (!globalForDb.mysqlPool) {
    globalForDb.mysqlPool = mysql.createPool({
      uri: getDatabaseUrl(),
      waitForConnections: true,
      connectionLimit: getPoolLimit(),
      queueLimit: getQueueLimit(),
      // Fail fast if the DB is unreachable instead of hanging the request/serverless invocation.
      connectTimeout: Number(process.env.DATABASE_CONNECT_TIMEOUT_MS || 15000),
      charset: "utf8mb4",
      dateStrings: false,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });
  }

  return globalForDb.mysqlPool;
}

export async function query<T = any>(sql: string, params: any[] = []) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const [rows] = await getPool().execute(sql, params);
      return rows as T[];
    } catch (error) {
      lastError = error;
      // Retry only read queries, and only for lost/refused connections.
      if (attempt < 2 && isTransientDbError(error)) {
        await new Promise((resolve) => setTimeout(resolve, 80 * (attempt + 1)));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export async function queryOne<T = any>(sql: string, params: any[] = []) {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function execute(sql: string, params: any[] = []) {
  const [result] = await getPool().execute(sql, params);
  return result as ResultSetHeader;
}

export type TransactionClient = {
  query: <T = any>(sql: string, params?: any[]) => Promise<T[]>;
  queryOne: <T = any>(sql: string, params?: any[]) => Promise<T | null>;
  execute: (sql: string, params?: any[]) => Promise<ResultSetHeader>;
};

function createTransactionClient(connection: PoolConnection): TransactionClient {
  return {
    async query<T = any>(sql: string, params: any[] = []) {
      const [rows] = await connection.execute(sql, params);
      return rows as T[];
    },
    async queryOne<T = any>(sql: string, params: any[] = []) {
      const rows = await this.query<T>(sql, params);
      return rows[0] ?? null;
    },
    async execute(sql: string, params: any[] = []) {
      const [result] = await connection.execute(sql, params);
      return result as ResultSetHeader;
    },
  };
}

export async function withTransaction<T>(fn: (tx: TransactionClient) => Promise<T>) {
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();
    const result = await fn(createTransactionClient(connection));
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
