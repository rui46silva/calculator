// Creates/updates the database schema: Better Auth tables + the app's user_data table.
// Usage: DATABASE_URL=... npm run db:migrate
import pg from 'pg';
import { getMigrations } from 'better-auth/db/migration';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Must match the schema-relevant options in src/lib/server/auth.ts.
const { runMigrations, toBeCreated, toBeAdded } = await getMigrations({
  database: pool,
  emailAndPassword: { enabled: true },
});
if (toBeCreated.length || toBeAdded.length) {
  await runMigrations();
  console.log('Better Auth tables migrated:', [...toBeCreated, ...toBeAdded].map((t) => t.table).join(', '));
} else {
  console.log('Better Auth tables up to date');
}

await pool.query(`
  create table if not exists user_data (
    user_id       text primary key references "user" (id) on delete cascade,
    data          jsonb  not null,
    updated_at_ms bigint not null
  )
`);
console.log('user_data table ready');
await pool.end();
