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

export function getPool() {
  if (!globalForDb.mysqlPool) {
    globalForDb.mysqlPool = mysql.createPool({
      uri: getDatabaseUrl(),
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      charset: "utf8mb4",
      dateStrings: false,
    });
  }

  return globalForDb.mysqlPool;
}

export async function query<T = any>(sql: string, params: any[] = []) {
  const [rows] = await getPool().execute(sql, params);
  return rows as T[];
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
