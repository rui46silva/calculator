import type { Lot } from '../../data/types';
import type { PricePoint } from '../market/types';

export interface LotsSummary {
  units: number;
  /** Total cost including fees. */
  invested: number;
  averagePrice: number;
}

export function summarizeLots(lots: Lot[]): LotsSummary {
  const units = lots.reduce((a, l) => a + l.units, 0);
  const invested = lots.reduce((a, l) => a + l.units * l.price + (l.fees || 0), 0);
  return { units, invested, averagePrice: units > 0 ? invested / units : 0 };
}

export interface CashFlow {
  date: Date;
  /** Negative for money in (purchases), positive for money out (current value). */
  amount: number;
}

/**
 * Annualised money-weighted return (XIRR): the rate at which the purchases, each at its own
 * date, grow into today's value. Returns null when it can't be determined.
 */
export function xirr(flows: CashFlow[]): number | null {
  if (flows.length < 2 || !flows.some((f) => f.amount < 0) || !flows.some((f) => f.amount > 0)) return null;
  const t0 = Math.min(...flows.map((f) => f.date.getTime()));
  const years = flows.map((f) => (f.date.getTime() - t0) / (365.25 * 86_400_000));
  if (Math.max(...years) < 1 / 365) return null;
  const npv = (r: number) => flows.reduce((a, f, i) => a + f.amount / Math.pow(1 + r, years[i]), 0);

  // Bisection on a wide bracket: robust where Newton's method can diverge.
  let lo = -0.9999;
  let hi = 10;
  let fLo = npv(lo);
  if (fLo * npv(hi) > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid);
    if (Math.abs(fMid) < 1e-9) return mid;
    if (fLo * fMid < 0) hi = mid;
    else {
      lo = mid;
      fLo = fMid;
    }
  }
  return (lo + hi) / 2;
}

export function lotsXirr(lots: Lot[], currentValue: number, today = new Date()): number | null {
  return xirr([
    ...lots.map((l) => ({ date: new Date(`${l.date}T00:00:00`), amount: -(l.units * l.price + (l.fees || 0)) })),
    { date: today, amount: currentValue },
  ]);
}

export interface RebalanceRow {
  assetClass: string;
  current: number;
  currentShare: number;
  target: number;
  /** How much of this month's contribution should go to this class. */
  buy: number;
}

/**
 * Splits a new contribution so the portfolio moves towards the target allocation without
 * selling anything: the most underweight classes are topped up first.
 */
export function rebalance(values: Record<string, number>, targets: Record<string, number>, contribution: number): RebalanceRow[] {
  const classes = [...new Set([...Object.keys(values), ...Object.keys(targets)])];
  const total = classes.reduce((a, c) => a + (values[c] ?? 0), 0);
  const targetSum = classes.reduce((a, c) => a + (targets[c] ?? 0), 0) || 1;
  const after = total + contribution;
  const deficits = classes.map((c) => Math.max(0, ((targets[c] ?? 0) / targetSum) * after - (values[c] ?? 0)));
  const deficitSum = deficits.reduce((a, b) => a + b, 0);

  return classes
    .map((c, i) => {
      let buy: number;
      if (contribution <= 0) buy = 0;
      else if (deficitSum >= contribution) buy = (deficits[i] / deficitSum) * contribution;
      else buy = deficits[i] + ((targets[c] ?? 0) / targetSum) * (contribution - deficitSum);
      return {
        assetClass: c,
        current: values[c] ?? 0,
        currentShare: total > 0 ? (values[c] ?? 0) / total : 0,
        target: (targets[c] ?? 0) / targetSum,
        buy,
      };
    })
    .sort((a, b) => b.target - a.target || b.current - a.current);
}

export interface Drawdown {
  /** Fall from the highest close (all-time), as a negative fraction. */
  fromHigh: number;
  high: number;
  level: 'none' | 'correction' | 'bear';
}

export const CORRECTION = -0.1;
export const BEAR_MARKET = -0.2;

/** How far the current price is below the highest price in the series. */
export function drawdown(points: PricePoint[], price: number): Drawdown {
  const high = Math.max(price, ...points.map((p) => p.close));
  const fromHigh = high > 0 ? price / high - 1 : 0;
  return { fromHigh, high, level: fromHigh <= BEAR_MARKET ? 'bear' : fromHigh <= CORRECTION ? 'correction' : 'none' };
}
