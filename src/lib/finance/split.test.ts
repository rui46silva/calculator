import { describe, expect, it } from 'vitest';
import type { Transaction } from '../../data/types';
import { settleUp, splitBalances } from './split';

const tx = (amount: number, paidBy?: string, shared?: boolean): Transaction => ({
  id: `${amount}${paidBy}`,
  date: '2026-10-01',
  description: 'x',
  amount,
  type: 'expense',
  category: 'Outros',
  source: 'manual',
  paidBy,
  shared,
});

describe('split', () => {
  it('splits shared expenses equally and suggests who pays whom', () => {
    const b = splitBalances([tx(100, 'ana'), tx(40, 'rui'), tx(20, 'ana', false)], [], ['rui', 'ana'], 'rui');
    expect(b).toEqual([
      { userId: 'rui', paid: 40, share: 70, balance: -30 },
      { userId: 'ana', paid: 100, share: 70, balance: 30 },
    ]);
    expect(settleUp(b)).toEqual([{ from: 'rui', to: 'ana', amount: 30 }]);
  });

  it('accounts for settlements and unattributed expenses', () => {
    const b = splitBalances([tx(100, 'ana'), tx(60)], [{ id: 's', date: '2026-10-02', from: 'rui', to: 'ana', amount: 20 }], ['rui', 'ana'], 'rui');
    // rui paid 60 (fallback), ana 100; share 80 → rui −20, ana +20; settlement of 20 evens it out.
    expect(b.map((x) => x.balance)).toEqual([0, 0]);
    expect(settleUp(b)).toEqual([]);
  });

  it('settles three people with the fewest transfers', () => {
    const b = splitBalances([tx(90, 'a')], [], ['a', 'b', 'c'], 'a');
    expect(settleUp(b)).toEqual([
      { from: 'b', to: 'a', amount: 30 },
      { from: 'c', to: 'a', amount: 30 },
    ]);
  });

  it('does nothing for a single person', () => {
    expect(splitBalances([tx(10, 'a')], [], ['a'], 'a')).toEqual([]);
  });
});
