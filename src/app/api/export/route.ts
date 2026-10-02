import { NextResponse } from 'next/server';
import { emptyData } from '@/data/types';
import { buildWorkbook } from '@/lib/server/excel';
import { dataKeyFor, loadData, sessionUser } from '@/lib/server/userData';

/** Downloads all of the user's data as an .xlsx file. */
export async function GET() {
  const user = await sessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const data = { ...emptyData(), ...((await loadData(await dataKeyFor(user.id))) ?? {}) };
  const file = await buildWorkbook(data, user.name || user.email);
  const name = `financas-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(new Uint8Array(file), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'no-store',
    },
  });
}
