import type { PricePoint, PriceSeries } from './types';

interface YahooChart {
  chart?: {
    result?: {
      meta?: {
        symbol?: string;
        currency?: string;
        longName?: string;
        shortName?: string;
        regularMarketPrice?: number;
        regularMarketTime?: number;
      };
      timestamp?: number[];
      indicators?: {
        quote?: { close?: (number | null)[] }[];
        adjclose?: { adjclose?: (number | null)[] }[];
      };
    }[];
    error?: { description?: string } | null;
  };
}

/** Parses Yahoo Finance's v8 chart response (interval=1mo). */
export function parseYahooChart(json: unknown, symbol: string): PriceSeries {
  const res = (json as YahooChart).chart?.result?.[0];
  if (!res?.timestamp?.length) {
    throw new Error((json as YahooChart).chart?.error?.description ?? `Sem dados para ${symbol}`);
  }
  const closes = res.indicators?.adjclose?.[0]?.adjclose ?? res.indicators?.quote?.[0]?.close ?? [];
  const points: PricePoint[] = [];
  res.timestamp.forEach((ts, i) => {
    const close = closes[i];
    if (typeof close === 'number' && Number.isFinite(close) && close > 0) points.push({ t: ts * 1000, close });
  });
  if (points.length < 2) throw new Error(`Histórico insuficiente para ${symbol}`);
  const meta = res.meta ?? {};
  const last = points[points.length - 1];
  return {
    symbol: meta.symbol ?? symbol,
    name: meta.longName ?? meta.shortName ?? symbol,
    currency: meta.currency ?? '',
    price: meta.regularMarketPrice ?? last.close,
    asOf: meta.regularMarketTime ? meta.regularMarketTime * 1000 : last.t,
    points,
    source: 'yahoo',
  };
}

/** Maps a Yahoo-style ticker to Stooq's naming (SPY → spy.us, SXR8.DE → sxr8.de, CSPX.L → cspx.uk). */
export function toStooqSymbol(symbol: string): string {
  const s = symbol.toLowerCase();
  if (s.endsWith('.l')) return s.slice(0, -2) + '.uk';
  return s.includes('.') ? s : `${s}.us`;
}

const STOOQ_CURRENCY: Record<string, string> = { us: 'USD', de: 'EUR', uk: 'GBP', jp: 'JPY' };

/** Parses Stooq's monthly CSV export (Date,Open,High,Low,Close,Volume). Closes are not dividend-adjusted. */
export function parseStooqCsv(csv: string, symbol: string): PriceSeries {
  const lines = csv.trim().split(/\r?\n/);
  if (!/^date,/i.test(lines[0] ?? '')) throw new Error(`Sem dados para ${symbol}`);
  const points: PricePoint[] = [];
  for (const line of lines.slice(1)) {
    const [date, , , , close] = line.split(',');
    const t = Date.parse(`${date}T00:00:00Z`);
    const c = Number(close);
    if (Number.isFinite(t) && Number.isFinite(c) && c > 0) points.push({ t, close: c });
  }
  if (points.length < 2) throw new Error(`Histórico insuficiente para ${symbol}`);
  const last = points[points.length - 1];
  const suffix = toStooqSymbol(symbol).split('.').pop() ?? '';
  return {
    symbol: symbol.toUpperCase(),
    name: symbol.toUpperCase(),
    currency: STOOQ_CURRENCY[suffix] ?? '',
    price: last.close,
    asOf: last.t,
    points,
    source: 'stooq',
  };
}
