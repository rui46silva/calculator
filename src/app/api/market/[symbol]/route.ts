import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/server/auth';
import { getPriceSeries } from '@/lib/server/market';
import { SYMBOL_PATTERN } from '@/lib/market/types';

export async function GET(_req: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const session = await getAuth()?.getSession();
  if (!session?.data?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { symbol } = await params;
  if (!SYMBOL_PATTERN.test(symbol)) return NextResponse.json({ error: 'Ticker inválido' }, { status: 400 });

  try {
    const series = await getPriceSeries(symbol.toUpperCase());
    return NextResponse.json(series, { headers: { 'Cache-Control': 'private, max-age=900' } });
  } catch (err) {
    return NextResponse.json({ error: `Não foi possível obter cotações de ${symbol}: ${(err as Error).message}` }, { status: 502 });
  }
}
