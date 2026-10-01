import { NextResponse } from 'next/server';
import { authBaseUrl, authConfigProblems } from '@/lib/server/auth';
import { pool } from '@/lib/server/db';

export const dynamic = 'force-dynamic';

/** Setup diagnostics for the deployment. Reports booleans and status codes only, never secrets. */
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const problems = authConfigProblems();
  const base = authBaseUrl();

  const auth: Record<string, unknown> = { configured: problems.length === 0, problems, host: base ? new URL(base).host : null };
  if (base) {
    try {
      const res = await fetch(`${base}/get-session`, { headers: { Origin: origin }, cache: 'no-store', signal: AbortSignal.timeout(8000) });
      auth.upstream = { reachable: true, status: res.status };
    } catch (err) {
      auth.upstream = { reachable: false, error: (err as Error).message };
    }
  }

  const database: Record<string, unknown> = { configured: !!process.env.DATABASE_URL };
  if (process.env.DATABASE_URL) {
    try {
      const { rows } = await pool.query<{ user_data: boolean; neon_auth: boolean }>(
        `select to_regclass('public.user_data') is not null as user_data,
                exists (select 1 from information_schema.schemata where schema_name = 'neon_auth') as neon_auth`,
      );
      database.reachable = true;
      database.userDataTable = rows[0].user_data;
      database.neonAuthSchema = rows[0].neon_auth;
    } catch (err) {
      database.reachable = false;
      database.error = (err as Error).message;
    }
  }

  return NextResponse.json({ origin, auth, database }, { headers: { 'Cache-Control': 'no-store' } });
}
