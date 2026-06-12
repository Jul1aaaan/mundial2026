import mysql from "mysql2/promise";

// Reutilizamos el pool entre invocaciones (importante en serverless / Vercel).
declare global {
  // eslint-disable-next-line no-var
  var _tidbPool: mysql.Pool | undefined;
}

function createPool(): mysql.Pool {
  return mysql.createPool({
    host: process.env.TIDB_HOST,
    port: Number(process.env.TIDB_PORT ?? 4000),
    user: process.env.TIDB_USER,
    password: process.env.TIDB_PASSWORD,
    database: process.env.TIDB_DATABASE,
    connectionLimit: 5,
    enableKeepAlive: true,
    // TiDB Cloud serverless exige TLS. El certificado es publico (ISRG/Let's Encrypt),
    // por lo que el CA bundle de Node alcanza, no hace falta un archivo .pem.
    ssl: {
      minVersion: "TLSv1.2",
      rejectUnauthorized: true,
    },
  });
}

export const pool: mysql.Pool = global._tidbPool ?? createPool();
if (process.env.NODE_ENV !== "production") global._tidbPool = pool;

// Helper tipado para queries.
export async function query<T = mysql.RowDataPacket[]>(
  sql: string,
  params?: unknown[]
): Promise<T> {
  const [rows] = await pool.query(sql, params);
  return rows as T;
}
