import { describe, expect, it } from 'vitest';
import { emptyData, type AppData, type Transaction } from './types';
import { mergeData } from './merge';

const tx = (id: string, amount: number): Transaction => ({ id, date: '2026-10-01', description: id, amount, type: 'expense', category: 'Outros', source: 'manual' });
const doc = (patch: Partial<AppData>, updatedAt = 1): AppData => ({ ...emptyData(), ...patch, updatedAt });

describe('mergeData', () => {
  const base = doc({ transactions: [tx('a', 10), tx('b', 20)], categoryBudgets: { Lazer: 50 } }, 100);

  it('keeps additions from both sides', () => {
    const local = doc({ transactions: [...base.transactions, tx('mine', 40)] }, 200);
    const remote = doc({ transactions: [...base.transactions, tx('theirs', 100)] }, 150);
    const m = mergeData(base, local, remote);
    expect(m.transactions.map((t) => t.id).sort()).toEqual(['a', 'b', 'mine', 'theirs']);
    expect(m.updatedAt).toBeGreaterThan(150);
  });

  it('applies deletions and edits from either side', () => {
    const local = doc({ transactions: [tx('a', 11)] }, 200); // edited a, deleted b
    const remote = doc({ transactions: [tx('a', 10), tx('b', 20), tx('c', 5)] }, 150);
    expect(mergeData(base, local, remote).transactions).toEqual([tx('a', 11), tx('c', 5)]);
  });

  it('keeps an item edited on one side even if the other deleted it', () => {
    const local = doc({ transactions: [tx('a', 10)] }, 200); // deleted b
    const remote = doc({ transactions: [tx('a', 10), tx('b', 25)] }, 150); // edited b
    expect(mergeData(base, local, remote).transactions.map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('merges plain fields by whoever changed them', () => {
    const local = doc({ transactions: base.transactions, categoryBudgets: { Lazer: 50 }, budgetRule: { emergencyFund: 1000, emergencyMonths: 6 } }, 200);
    const remote = doc({ transactions: base.transactions, categoryBudgets: { Lazer: 80 } }, 150);
    const m = mergeData(base, local, remote);
    expect(m.categoryBudgets).toEqual({ Lazer: 80 });
    expect(m.budgetRule).toEqual({ emergencyFund: 1000, emergencyMonths: 6 });
  });

  it('merges snapshots by month', () => {
    const snap = (month: string, netWorth: number) => ({ month, income: 0, outgoing: 0, savings: 0, investments: 0, assets: 0, debt: 0, netWorth });
    const m = mergeData(doc({ snapshots: [snap('2026-09', 1)] }), doc({ snapshots: [snap('2026-09', 1), snap('2026-10', 5)] }, 3), doc({ snapshots: [snap('2026-09', 2)] }, 2));
    expect(m.snapshots).toEqual([snap('2026-09', 2), snap('2026-10', 5)]);
  });
});
