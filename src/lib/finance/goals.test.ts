import { describe, expect, it } from 'vitest';
import { emptyData, type AppData } from '../../data/types';
import { goalPlan, monthsUntil } from './goals';
import { currentSnapshot, monthlySummary, withCurrentSnapshot } from '../summary';

const today = new Date(2026, 9, 2);

describe('goals', () => {
  it('counts whole months to the target date', () => {
    expect(monthsUntil('2027-10-02', today)).toBe(12);
    expect(monthsUntil('2027-10-01', today)).toBe(11);
    expect(monthsUntil('2026-09-01', today)).toBe(0);
  });

  it('works out the monthly saving needed', () => {
    const p = goalPlan({ id: 'g', name: 'Viagem', icon: '✈', target: 3000, saved: 600, targetDate: '2027-10-02' }, today);
    expect(p).toMatchObject({ remaining: 2400, monthsLeft: 12, monthly: 200, status: 'active' });
    expect(p.progress).toBeCloseTo(0.2, 6);
  });

  it('flags finished and overdue goals', () => {
    expect(goalPlan({ id: 'g', name: 'x', icon: '', target: 100, saved: 150, targetDate: '2027-01-01' }, today).status).toBe('done');
    expect(goalPlan({ id: 'g', name: 'x', icon: '', target: 100, saved: 50, targetDate: '2026-08-01' }, today)).toMatchObject({ status: 'overdue', monthly: 50 });
  });
});

describe('net worth and snapshots', () => {
  const data: AppData = {
    ...emptyData(),
    incomes: [{ id: 'i', name: 'Salário', amount: 2000, frequency: 'monthly' }],
    expenses: [{ id: 'e', name: 'Renda', category: 'Habitação', amount: 500, frequency: 'monthly' }],
    investments: [{ id: 'v', name: 'ETF', assetClass: 'ETF', invested: 1000, currentValue: 1200, monthlyContribution: 0 }],
    assets: [{ id: 'a', name: 'Casa', type: 'Imóvel', value: 200000 }],
    loans: [{ id: 'l', name: 'Casa', type: 'Habitação', principal: 150000, annualRate: 0, months: 300, startDate: '2030-01-01' }],
  };

  it('includes assets in net worth', () => {
    const s = monthlySummary(data, today);
    expect(s.assets).toBe(200000);
    expect(s.netWorth).toBe(1200 + 200000 - 150000);
  });

  it('records the current month and only changes when values change', () => {
    const snap = currentSnapshot(data, today);
    expect(snap).toEqual({ month: '2026-10', income: 2000, outgoing: 500, savings: 1500, investments: 1200, assets: 200000, debt: 150000, netWorth: 51200 });
    const list = withCurrentSnapshot({ ...data, snapshots: [{ ...snap, month: '2026-09', netWorth: 1 }] }, today)!;
    expect(list.map((s) => s.month)).toEqual(['2026-09', '2026-10']);
    expect(withCurrentSnapshot({ ...data, snapshots: list }, today)).toBeNull();
  });
});
