import { describe, expect, it } from 'vitest';
import { drawdown, lotsXirr, rebalance, summarizeLots, xirr } from './portfolio';

describe('lots', () => {
  it('sums units, cost with fees and average price', () => {
    const s = summarizeLots([
      { id: '1', date: '2025-01-10', units: 2, price: 500, fees: 1 },
      { id: '2', date: '2025-06-10', units: 3, price: 550, fees: 1 },
    ]);
    expect(s.units).toBe(5);
    expect(s.invested).toBe(2652);
    expect(s.averagePrice).toBeCloseTo(530.4, 6);
  });
});

describe('xirr', () => {
  it('matches a simple one-year return', () => {
    expect(xirr([{ date: new Date(2025, 0, 1), amount: -1000 }, { date: new Date(2026, 0, 1), amount: 1100 }])).toBeCloseTo(0.1, 3);
  });

  it('weights each purchase by how long it was invested', () => {
    // 1000 for two years + 1000 for one year at 10%/yr → 1210 + 1100 = 2310.
    const r = lotsXirr(
      [
        { id: 'a', date: '2024-01-01', units: 1, price: 1000, fees: 0 },
        { id: 'b', date: '2025-01-01', units: 1, price: 1000, fees: 0 },
      ],
      2310,
      new Date(2026, 0, 1),
    );
    expect(r).toBeCloseTo(0.1, 3);
  });

  it('handles losses and refuses impossible cases', () => {
    expect(xirr([{ date: new Date(2025, 0, 1), amount: -1000 }, { date: new Date(2026, 0, 1), amount: 800 }])).toBeCloseTo(-0.2, 3);
    expect(xirr([{ date: new Date(2025, 0, 1), amount: -1000 }])).toBeNull();
  });
});

describe('rebalance', () => {
  it('tops up the underweight class first', () => {
    const rows = rebalance({ ETF: 8000, Obrigações: 1000 }, { ETF: 0.8, Obrigações: 0.2 }, 500);
    const by = Object.fromEntries(rows.map((r) => [r.assetClass, r]));
    // After: 9500 → targets 7600 / 1900. Bonds are 900 short, more than the 500 available.
    expect(by['Obrigações'].buy).toBeCloseTo(500, 6);
    expect(by['ETF'].buy).toBeCloseTo(0, 6);
    expect(by['ETF'].currentShare).toBeCloseTo(8 / 9, 6);
  });

  it('splits the leftover by target once balanced', () => {
    const rows = rebalance({ ETF: 800, Obrigações: 200 }, { ETF: 0.8, Obrigações: 0.2 }, 100);
    const by = Object.fromEntries(rows.map((r) => [r.assetClass, r.buy]));
    expect(by['ETF']).toBeCloseTo(80, 6);
    expect(by['Obrigações']).toBeCloseTo(20, 6);
  });

  it('includes target classes not yet owned and normalises targets', () => {
    const rows = rebalance({ ETF: 1000 }, { ETF: 70, PPR: 30 }, 300);
    const by = Object.fromEntries(rows.map((r) => [r.assetClass, r]));
    expect(by['PPR'].target).toBeCloseTo(0.3, 6);
    expect(by['PPR'].buy).toBeCloseTo(300, 6);
  });
});

describe('drawdown', () => {
  const pts = [100, 120, 110].map((close, i) => ({ t: i, close }));
  it('classifies falls from the high', () => {
    expect(drawdown(pts, 115).level).toBe('none');
    expect(drawdown(pts, 105)).toMatchObject({ level: 'correction', high: 120 });
    expect(drawdown(pts, 90).level).toBe('bear');
    expect(drawdown(pts, 130).fromHigh).toBe(0);
  });
});
