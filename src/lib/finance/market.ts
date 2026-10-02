import type { PricePoint } from '../market/types';

/** Simple monthly returns, e.g. 0.01 for +1%. */
export function monthlyReturns(points: PricePoint[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < points.length; i++) r.push(points[i].close / points[i - 1].close - 1);
  return r;
}

export interface SeriesStats {
  years: number;
  /** Compound annual growth rate over the whole series. */
  cagr: number;
  /** Annualised standard deviation of monthly returns. */
  volatility: number;
  /** Worst peak-to-trough fall, as a negative fraction. */
  maxDrawdown: number;
  /** CAGR over the last N years, when the series is long enough. */
  trailing: { years: number; cagr: number }[];
}

export function seriesStats(points: PricePoint[]): SeriesStats {
  const first = points[0];
  const last = points[points.length - 1];
  const years = (points.length - 1) / 12;
  const cagr = years > 0 ? Math.pow(last.close / first.close, 1 / years) - 1 : 0;

  const r = monthlyReturns(points);
  const mean = r.reduce((a, b) => a + b, 0) / Math.max(r.length, 1);
  const variance = r.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(r.length - 1, 1);
  const volatility = Math.sqrt(variance) * Math.sqrt(12);

  let peak = first.close;
  let maxDrawdown = 0;
  for (const p of points) {
    peak = Math.max(peak, p.close);
    maxDrawdown = Math.min(maxDrawdown, p.close / peak - 1);
  }

  const trailing = [1, 3, 5, 10, 20]
    .filter((n) => points.length > n * 12)
    .map((n) => ({ years: n, cagr: Math.pow(last.close / points[points.length - 1 - n * 12].close, 1 / n) - 1 }));

  return { years, cagr, volatility, maxDrawdown, trailing };
}

/** Deterministic PRNG so simulations are stable between renders. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export interface SimulationInput {
  /** Historical monthly returns to resample from. */
  returns: number[];
  initial: number;
  monthlyContribution: number;
  years: number;
  paths?: number;
  /** Length of resampled blocks, keeping some of the momentum and crash clustering of real markets. */
  blockMonths?: number;
  seed?: number;
}

export interface SimulationYear {
  year: number;
  contributed: number;
  p10: number;
  p50: number;
  p90: number;
}

export interface SimulationResult {
  years: SimulationYear[];
  /** Annualised money-weighted-free growth rates implied by the final percentiles of a lump sum. */
  annualRates: { p10: number; p50: number; p90: number };
  /** Share of paths that end below the amount contributed. */
  lossProbability: number;
}

/**
 * Block-bootstrap Monte Carlo: builds future paths by stitching together random
 * stretches of the asset's real monthly history, then reports the 10th/50th/90th percentiles.
 */
export function simulate(input: SimulationInput): SimulationResult {
  const { returns, initial, monthlyContribution, years } = input;
  const paths = input.paths ?? 2000;
  const block = Math.max(1, Math.min(input.blockMonths ?? 12, returns.length));
  const rand = mulberry32(input.seed ?? 42);
  const months = years * 12;

  // valueAt[y][path], growthAt[path] = lump-sum growth factor over the full horizon.
  const valueAt: number[][] = Array.from({ length: years + 1 }, () => new Array<number>(paths));
  const growth = new Array<number>(paths);

  for (let p = 0; p < paths; p++) {
    let value = initial;
    let factor = 1;
    valueAt[0][p] = value;
    let m = 0;
    while (m < months) {
      const start = Math.floor(rand() * (returns.length - block + 1));
      for (let k = 0; k < block && m < months; k++, m++) {
        const r = returns[start + k];
        value = value * (1 + r) + monthlyContribution;
        factor *= 1 + r;
        if ((m + 1) % 12 === 0) valueAt[(m + 1) / 12][p] = value;
      }
    }
    growth[p] = factor;
  }

  const out: SimulationYear[] = valueAt.map((vals, year) => {
    const sorted = [...vals].sort((a, b) => a - b);
    return {
      year,
      contributed: initial + monthlyContribution * 12 * year,
      p10: percentile(sorted, 0.1),
      p50: percentile(sorted, 0.5),
      p90: percentile(sorted, 0.9),
    };
  });

  const g = [...growth].sort((a, b) => a - b);
  const rate = (f: number) => Math.pow(f, 1 / years) - 1;
  const contributed = out[years].contributed;
  const losses = valueAt[years].filter((v) => v < contributed).length;

  return {
    years: out,
    annualRates: { p10: rate(percentile(g, 0.1)), p50: rate(percentile(g, 0.5)), p90: rate(percentile(g, 0.9)) },
    lossProbability: losses / paths,
  };
}

export interface RollingStats {
  windows: number;
  /** Share of N-year holding periods that ended below where they started. */
  lossShare: number;
  worst: number;
  median: number;
  best: number;
}

/** Annualised returns of every N-year holding period in the series (monthly steps). */
export function rollingReturns(points: PricePoint[], years: number): RollingStats | null {
  const span = years * 12;
  if (points.length <= span) return null;
  const rates: number[] = [];
  for (let i = 0; i + span < points.length; i++) rates.push(Math.pow(points[i + span].close / points[i].close, 1 / years) - 1);
  const sorted = [...rates].sort((a, b) => a - b);
  return {
    windows: rates.length,
    lossShare: rates.filter((r) => r < 0).length / rates.length,
    worst: sorted[0],
    median: percentile(sorted, 0.5),
    best: sorted[sorted.length - 1],
  };
}
