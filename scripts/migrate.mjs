// Creates/updates the app's database schema. User accounts live in the neon_auth schema, managed by Neon Auth.
// Idempotent, so it runs before every Vercel build (see "vercel-build" in package.json).
// Usage: DATABASE_URL=... npm run db:migrate
import pg from 'pg';

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

await pool.query(`
  create table if not exists user_data (
    user_id       text primary key,
    data          jsonb  not null,
    updated_at_ms bigint not null
  )
`);
// Earlier versions referenced Better Auth's own "user" table; accounts now live in neon_auth.
await pool.query('alter table user_data drop constraint if exists user_data_user_id_fkey');
console.log('user_data table ready');

// Shared households: members read and write one common data document (user_data key "household:<id>").
await pool.query(`
  create table if not exists households (
    id         text primary key,
    name       text not null,
    created_by text not null,
    created_at timestamptz not null default now()
  );
  create table if not exists household_members (
    user_id      text primary key,
    household_id text not null references households (id) on delete cascade,
    name         text not null default '',
    email        text not null default '',
    role         text not null default 'member',
    joined_at    timestamptz not null default now()
  );
  create index if not exists household_members_household on household_members (household_id);
  create table if not exists household_invites (
    code         text primary key,
    household_id text not null references households (id) on delete cascade,
    created_by   text not null,
    expires_at   timestamptz not null,
    used_by      text
  );
`);
console.log('household tables ready');
await pool.end();
