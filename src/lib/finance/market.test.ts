import { describe, expect, it } from 'vitest';
import { monthlyReturns, seriesStats, simulate } from './market';
import { parseStooqCsv, parseYahooChart, toStooqSymbol } from '../market/parse';

const month = (i: number) => Date.UTC(2010, i, 1);
const constantGrowth = (n: number, monthly: number) =>
  Array.from({ length: n }, (_, i) => ({ t: month(i), close: 100 * (1 + monthly) ** i }));

describe('seriesStats', () => {
  it('recovers the CAGR of a constant-growth series with zero volatility', () => {
    const s = seriesStats(constantGrowth(121, Math.pow(1.08, 1 / 12) - 1));
    expect(s.years).toBe(10);
    expect(s.cagr).toBeCloseTo(0.08, 10);
    expect(s.volatility).toBeCloseTo(0, 10);
    expect(s.maxDrawdown).toBe(0);
    expect(s.trailing.map((t) => t.years)).toEqual([1, 3, 5, 10]);
    expect(s.trailing[2].cagr).toBeCloseTo(0.08, 10);
  });

  it('measures the worst peak-to-trough drawdown', () => {
    const closes = [100, 120, 90, 60, 130, 110];
    const s = seriesStats(closes.map((close, i) => ({ t: month(i), close })));
    expect(s.maxDrawdown).toBeCloseTo(-0.5, 10);
  });
});

describe('simulate', () => {
  it('is exact when history has a single constant return', () => {
    const r = monthlyReturns(constantGrowth(61, 0.01));
    const res = simulate({ returns: r, initial: 1000, monthlyContribution: 0, years: 2, paths: 50 });
    const expected = 1000 * 1.01 ** 24;
    expect(res.years[2].p10).toBeCloseTo(expected, 6);
    expect(res.years[2].p90).toBeCloseTo(expected, 6);
    expect(res.annualRates.p50).toBeCloseTo(1.01 ** 12 - 1, 10);
    expect(res.lossProbability).toBe(0);
  });

  it('orders percentiles and counts contributions', () => {
    const returns = [0.05, -0.04, 0.02, -0.01, 0.03, -0.06, 0.04, 0.01];
    const res = simulate({ returns, initial: 0, monthlyContribution: 100, years: 5, paths: 500, blockMonths: 2 });
    const y5 = res.years[5];
    expect(y5.contributed).toBe(6000);
    expect(y5.p10).toBeLessThanOrEqual(y5.p50);
    expect(y5.p50).toBeLessThanOrEqual(y5.p90);
    expect(res.years).toHaveLength(6);
  });

  it('is deterministic for a given seed', () => {
    const returns = [0.05, -0.04, 0.02, -0.01, 0.03];
    const a = simulate({ returns, initial: 100, monthlyContribution: 10, years: 3, paths: 100, seed: 7 });
    const b = simulate({ returns, initial: 100, monthlyContribution: 10, years: 3, paths: 100, seed: 7 });
    expect(a).toEqual(b);
  });
});

describe('parseYahooChart', () => {
  it('uses adjusted closes and skips null months', () => {
    const json = {
      chart: {
        result: [
          {
            meta: { symbol: 'SXR8.DE', currency: 'EUR', longName: 'iShares Core S&P 500', regularMarketPrice: 612.3, regularMarketTime: 1790000000 },
            timestamp: [1700000000, 1702592000, 1705270400],
            indicators: { quote: [{ close: [500, null, 520] }], adjclose: [{ adjclose: [499, null, 519] }] },
          },
        ],
        error: null,
      },
    };
    const s = parseYahooChart(json, 'SXR8.DE');
    expect(s).toMatchObject({ symbol: 'SXR8.DE', currency: 'EUR', name: 'iShares Core S&P 500', price: 612.3, source: 'yahoo' });
    expect(s.points.map((p) => p.close)).toEqual([499, 519]);
    expect(s.asOf).toBe(1790000000 * 1000);
  });

  it('reports Yahoo errors', () => {
    expect(() => parseYahooChart({ chart: { result: null, error: { description: 'No data found' } } }, 'XXX')).toThrow('No data found');
  });
});

describe('Stooq', () => {
  it('maps tickers', () => {
    expect(toStooqSymbol('SPY')).toBe('spy.us');
    expect(toStooqSymbol('SXR8.DE')).toBe('sxr8.de');
    expect(toStooqSymbol('CSPX.L')).toBe('cspx.uk');
  });

  it('parses the monthly CSV', () => {
    const csv = 'Date,Open,High,Low,Close,Volume\n2024-01-31,470,490,465,482.1,100\n2024-02-29,482,510,480,508.4,120\n';
    const s = parseStooqCsv(csv, 'SPY');
    expect(s).toMatchObject({ symbol: 'SPY', currency: 'USD', price: 508.4, source: 'stooq' });
    expect(s.points).toHaveLength(2);
  });

  it('rejects non-CSV responses', () => {
    expect(() => parseStooqCsv('No data', 'XXX')).toThrow();
  });
});
