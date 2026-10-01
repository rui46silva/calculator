// Creates/updates the database schema: Better Auth tables + the app's user_data table.
// Idempotent, so it runs before every Vercel build (see "vercel-build" in package.json).
// Usage: DATABASE_URL=... npm run db:migrate
import pg from 'pg';
import { getMigrations } from 'better-auth/db/migration';

// Prefer Neon's direct (unpooled) connection for schema changes when the Vercel integration provides it.
const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!connectionString) {
  // A production deploy without a database is a misconfiguration; elsewhere (e.g. previews) just skip.
  if (process.env.VERCEL_ENV === 'production') {
    console.error('DATABASE_URL is not set: configure it in Vercel → Settings → Environment Variables');
    process.exit(1);
  }
  console.warn('DATABASE_URL is not set, skipping database migration');
  process.exit(0);
}

const pool = new pg.Pool({ connectionString });

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
