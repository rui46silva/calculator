import { Pool } from 'pg';

const globalForDb = globalThis as unknown as { pool?: Pool };

/** Shared connection pool. Use Neon's pooled connection string in DATABASE_URL. */
export const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
  });

if (process.env.NODE_ENV !== 'production') globalForDb.pool = pool;
