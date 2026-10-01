'use client';

import { useEffect, useState } from 'react';
import type { PriceSeries } from './market/types';

interface MarketState {
  data: PriceSeries | null;
  error: string | null;
  loading: boolean;
}

const cache = new Map<string, PriceSeries>();

export async function fetchSeries(symbol: string): Promise<PriceSeries> {
  const key = symbol.toUpperCase();
  const hit = cache.get(key);
  if (hit) return hit;
  const res = await fetch(`/api/market/${encodeURIComponent(key)}`);
  const body = (await res.json().catch(() => ({}))) as PriceSeries & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Erro ${res.status}`);
  cache.set(key, body);
  return body;
}

/** Monthly price history for a ticker. Keeps the previous result on screen while a new one loads. */
export function useMarket(symbol: string | null): MarketState {
  const [state, setState] = useState<MarketState>({ data: null, error: null, loading: false });

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setState((s) => ({ ...s, error: null, loading: true }));
    fetchSeries(symbol).then(
      (data) => !cancelled && setState({ data, error: null, loading: false }),
      (err: Error) => !cancelled && setState((s) => ({ ...s, error: err.message, loading: false })),
    );
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  return state;
}
