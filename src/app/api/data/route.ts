import { NextResponse } from 'next/server';
import { pool } from '@/lib/server/db';
import { dataKeyFor, loadData, sessionUser } from '@/lib/server/userData';
import type { AppData } from '@/data/types';

// Below Vercel's 4.5 MB request limit; plenty for years of movements.
const MAX_BYTES = 4_000_000;
const NO_STORE = { 'Cache-Control': 'no-store' };
const COLLECTIONS = ['incomes', 'expenses', 'loans', 'subscriptions', 'investments'] as const;

/** Key of the signed-in user's data document, or null without a session. */
async function userId(): Promise<string | null> {
  const user = await sessionUser();
  return user ? dataKeyFor(user.id) : null;
}

function isAppData(x: unknown): x is AppData {
  if (!x || typeof x !== 'object') return false;
  const d = x as Record<string, unknown>;
  return d.version === 1 && typeof d.updatedAt === 'number' && COLLECTIONS.every((c) => Array.isArray(d[c]));
}

/** Returns the signed-in user's saved data, or null if nothing has been saved yet. */
export async function GET() {
  const id = await userId();
  if (!id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json({ data: await loadData(id), scope: id }, { headers: NO_STORE });
}

/**
 * Saves the user's data if it is newer than what is stored (last write wins).
 * Responds 409 with the stored copy when the server already has a newer version.
 */
export async function PUT(req: Request) {
  const id = await userId();
  if (!id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // The client says which document it is editing; if the user joined or left a shared household
  // meanwhile, refuse rather than write personal data into the shared document (or vice versa).
  const scope = req.headers.get('x-data-scope');
  if (scope && scope !== id) return NextResponse.json({ error: 'scope_changed', scope: id }, { status: 409, headers: NO_STORE });

  const raw = await req.text();
  if (raw.length > MAX_BYTES) return NextResponse.json({ error: 'too large' }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  if (!isAppData(body)) return NextResponse.json({ error: 'invalid data' }, { status: 400 });

  // Optimistic concurrency: with X-Base-Version the write only succeeds if the stored copy is the one
  // the client started from; otherwise it gets the current copy back (409) and merges. Without the
  // header (older clients) the newest timestamp wins, as before.
  const baseHeader = req.headers.get('x-base-version');
  const base = baseHeader !== null && /^\d+$/.test(baseHeader) ? Number(baseHeader) : null;
  const { rowCount } = await pool.query(
    base === null
      ? `insert into user_data (user_id, data, updated_at_ms)
         values ($1, $2, $3)
         on conflict (user_id) do update
           set data = excluded.data, updated_at_ms = excluded.updated_at_ms
           where user_data.updated_at_ms < excluded.updated_at_ms`
      : `insert into user_data (user_id, data, updated_at_ms)
         values ($1, $2, $3)
         on conflict (user_id) do update
           set data = excluded.data, updated_at_ms = excluded.updated_at_ms
           where user_data.updated_at_ms = $4`,
    base === null ? [id, body, body.updatedAt] : [id, body, body.updatedAt, base],
  );
  if (rowCount === 0) {
    return NextResponse.json({ data: await loadData(id), scope: id }, { status: 409, headers: NO_STORE });
  }
  return NextResponse.json({ ok: true });
}
