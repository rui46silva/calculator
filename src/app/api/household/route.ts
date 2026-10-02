import { NextResponse } from 'next/server';
import { createHousehold, createInvite, getHousehold, HouseholdError, joinHousehold, leaveHousehold, removeMember } from '@/lib/server/household';
import { sessionUser } from '@/lib/server/userData';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET() {
  const user = await sessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json({ household: await getHousehold(user.id), userId: user.id }, { headers: NO_STORE });
}

type Body =
  | { action: 'create'; name?: string }
  | { action: 'invite' }
  | { action: 'join'; code?: string }
  | { action: 'leave'; keepCopy?: boolean }
  | { action: 'remove'; userId?: string };

export async function POST(req: Request) {
  const user = await sessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Body;
  try {
    switch (body.action) {
      case 'create':
        return NextResponse.json({ household: await createHousehold(user, body.name ?? '') }, { headers: NO_STORE });
      case 'invite':
        return NextResponse.json(await createInvite(user), { headers: NO_STORE });
      case 'join':
        return NextResponse.json({ household: await joinHousehold(user, body.code ?? '') }, { headers: NO_STORE });
      case 'leave':
        await leaveHousehold(user, !!body.keepCopy);
        return NextResponse.json({ household: null }, { headers: NO_STORE });
      case 'remove':
        await removeMember(user, body.userId ?? '');
        return NextResponse.json({ household: await getHousehold(user.id) }, { headers: NO_STORE });
      default:
        return NextResponse.json({ error: 'Ação desconhecida.' }, { status: 400 });
    }
  } catch (err) {
    const status = err instanceof HouseholdError ? err.status : 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
