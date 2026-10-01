import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/server/auth';
import { pool } from '@/lib/server/db';
import type { AppData } from '@/data/types';

const MAX_BYTES = 1_000_000;
const NO_STORE = { 'Cache-Control': 'no-store' };
const COLLECTIONS = ['incomes', 'expenses', 'loans', 'subscriptions', 'investments'] as const;

async function userId(): Promise<string | null> {
  const auth = getAuth();
  if (!auth) return null;
  const { data } = await auth.getSession();
  return data?.user?.id ?? null;
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
  const { rows } = await pool.query<{ data: AppData }>('select data from user_data where user_id = $1', [id]);
  return NextResponse.json({ data: rows[0]?.data ?? null }, { headers: NO_STORE });
}

/**
 * Saves the user's data if it is newer than what is stored (last write wins).
 * Responds 409 with the stored copy when the server already has a newer version.
 */
export async function PUT(req: Request) {
  const id = await userId();
  if (!id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const raw = await req.text();
  if (raw.length > MAX_BYTES) return NextResponse.json({ error: 'too large' }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  if (!isAppData(body)) return NextResponse.json({ error: 'invalid data' }, { status: 400 });

  const { rowCount } = await pool.query(
    `insert into user_data (user_id, data, updated_at_ms)
     values ($1, $2, $3)
     on conflict (user_id) do update
       set data = excluded.data, updated_at_ms = excluded.updated_at_ms
       where user_data.updated_at_ms < excluded.updated_at_ms`,
    [id, body, body.updatedAt],
  );
  if (rowCount === 0) {
    const { rows } = await pool.query<{ data: AppData }>('select data from user_data where user_id = $1', [id]);
    return NextResponse.json({ data: rows[0]?.data ?? null }, { status: 409, headers: NO_STORE });
  }
  return NextResponse.json({ ok: true });
}
