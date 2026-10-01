import { parseStooqCsv, parseYahooChart, toStooqSymbol } from '../market/parse';
import type { PriceSeries } from '../market/types';

const REVALIDATE_SECONDS = 3600;
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; financas-pessoais/1.0)' };

async function fromYahoo(symbol: string): Promise<PriceSeries> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=max&interval=1mo&includeAdjustedClose=true`;
  const res = await fetch(url, { headers: HEADERS, next: { revalidate: REVALIDATE_SECONDS } });
  if (!res.ok) throw new Error(`Yahoo ${res.status}`);
  return parseYahooChart(await res.json(), symbol);
}

async function fromStooq(symbol: string): Promise<PriceSeries> {
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(toStooqSymbol(symbol))}&i=m`;
  const res = await fetch(url, { headers: HEADERS, next: { revalidate: REVALIDATE_SECONDS } });
  if (!res.ok) throw new Error(`Stooq ${res.status}`);
  return parseStooqCsv(await res.text(), symbol);
}

/** Monthly price history for a ticker: Yahoo Finance first (dividend-adjusted), Stooq as a fallback. */
export async function getPriceSeries(symbol: string): Promise<PriceSeries> {
  try {
    return await fromYahoo(symbol);
  } catch (yahooError) {
    try {
      return await fromStooq(symbol);
    } catch {
      throw yahooError;
    }
  }
}
