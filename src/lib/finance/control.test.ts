import { describe, expect, it } from 'vitest';
import { emptyData, type AppData, type Transaction } from '../../data/types';
import { budgetStatus } from './budgets';
import { addMonths, occurrences, upcomingPayments } from './calendar';
import { detectRecurring, normalizeDescription } from './recurring';

const tx = (date: string, amount: number, category: string, description = category): Transaction => ({
  id: `${date}-${description}-${amount}`,
  date,
  description,
  amount,
  type: 'expense',
  category,
  source: 'manual',
});

describe('budgetStatus', () => {
  const today = new Date(2026, 9, 10); // 10 Oct, 31-day month
  const list = [tx('2026-10-02', 70, 'Restauração'), tx('2026-10-05', 15, 'Restauração'), tx('2026-10-06', 30, 'Compras'), tx('2026-09-30', 500, 'Compras')];

  it('reports spent, share, level and month-end projection', () => {
    const s = budgetStatus(list, { Restauração: 100, Compras: 200, Lazer: 0 }, '2026-10', today);
    expect(s.map((b) => b.category)).toEqual(['Restauração', 'Compras']);
    expect(s[0]).toMatchObject({ spent: 85, share: 0.85, level: 'warn' });
    expect(s[0].projected).toBeCloseTo((85 / 10) * 31, 6);
    expect(s[1]).toMatchObject({ spent: 30, level: 'ok' });
  });

  it('marks overspending and uses actuals for past months', () => {
    const s = budgetStatus(list, { Compras: 400 }, '2026-09', today);
    expect(s[0]).toMatchObject({ spent: 500, level: 'over', projected: 500 });
  });

  it('returns nothing without budgets', () => {
    expect(budgetStatus(list, undefined, '2026-10', today)).toEqual([]);
  });
});

describe('calendar', () => {
  it('clamps month ends', () => {
    expect(addMonths(new Date(2026, 0, 31), 1).getDate()).toBe(28);
    expect(addMonths(new Date(2026, 0, 31), 2, 31).getDate()).toBe(31);
  });

  it('expands recurrences inside a range', () => {
    const from = new Date(2026, 9, 1);
    const to = new Date(2027, 2, 31);
    expect(occurrences('2025-03-15', 'quarterly', from, to).map((d) => d.toISOString().slice(0, 7))).toEqual(['2026-12', '2027-03']);
    expect(occurrences('2026-01-31', 'monthly', new Date(2026, 1, 1), new Date(2026, 2, 31)).map((d) => d.getDate())).toEqual([28, 31]);
    expect(occurrences('2026-10-01', 'weekly', new Date(2026, 9, 5), new Date(2026, 9, 20))).toHaveLength(2);
    expect(occurrences('2027-05-01', 'annual', from, to)).toEqual([]);
  });

  it('lists loan, subscription and dated expense payments', () => {
    const data: AppData = {
      ...emptyData(),
      loans: [{ id: 'l', name: 'Carro', type: 'Automóvel', principal: 1200, annualRate: 0, months: 12, startDate: '2026-01-08' }],
      subscriptions: [{ id: 's', name: 'Netflix', category: 'Streaming', amount: 15, frequency: 'monthly', nextRenewal: '2026-10-20', rarelyUsed: false }],
      expenses: [
        { id: 'e', name: 'IMI', category: 'Impostos', amount: 300, frequency: 'annual', dueDate: '2027-05-31' },
        { id: 'e2', name: 'Seguro', category: 'Seguros', amount: 80, frequency: 'semiannual', dueDate: '2026-04-15' },
      ],
    };
    const ev = upcomingPayments(data, new Date(2026, 9, 1), new Date(2026, 11, 31));
    expect(ev.map((e) => `${e.date} ${e.title}`)).toEqual([
      '2026-10-08 Carro',
      '2026-10-15 Seguro',
      '2026-10-20 Netflix',
      '2026-11-08 Carro',
      '2026-11-20 Netflix',
      '2026-12-08 Carro',
      '2026-12-20 Netflix',
    ]);
    expect(ev[0].amount).toBe(100);
    // The 12-month loan ends in December 2026.
    expect(upcomingPayments(data, new Date(2027, 0, 1), new Date(2027, 0, 31)).some((e) => e.kind === 'loan')).toBe(false);
  });
});

describe('detectRecurring', () => {
  const today = new Date(2026, 9, 10);
  it('finds a stable monthly charge across 3+ months', () => {
    const data: AppData = {
      ...emptyData(),
      transactions: [
        tx('2026-07-03', 34.99, 'Lazer', 'Ginásio Solinca'),
        tx('2026-08-03', 34.99, 'Lazer', 'GINASIO SOLINCA'),
        tx('2026-09-03', 34.99, 'Lazer', 'Ginásio Solinca 09'),
        tx('2026-10-03', 34.99, 'Lazer', 'Ginásio Solinca'),
        tx('2026-08-10', 40, 'Restauração', 'Jantar'),
        tx('2026-09-11', 120, 'Restauração', 'Jantar'),
        tx('2026-10-12', 15, 'Restauração', 'Jantar'),
      ],
    };
    const s = detectRecurring(data, today);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ key: 'ginasio solinca', months: 4, averageAmount: 34.99, suggestion: 'subscription' });
  });

  it('skips known fixed items and dismissed suggestions', () => {
    const base: AppData = {
      ...emptyData(),
      transactions: ['2026-08-01', '2026-09-01', '2026-10-01'].map((d) => tx(d, 50, 'Casa', 'Limpeza')),
    };
    expect(detectRecurring(base, today)).toHaveLength(1);
    expect(detectRecurring({ ...base, dismissedRecurring: ['limpeza'] }, today)).toHaveLength(0);
    expect(
      detectRecurring({ ...base, expenses: [{ id: 'e', name: 'Limpeza', category: 'Habitação', amount: 50, frequency: 'monthly' }] }, today),
    ).toHaveLength(0);
  });

  it('normalises descriptions', () => {
    expect(normalizeDescription('  NETFLIX.COM 12/09 ')).toBe('netflix com');
  });
});
