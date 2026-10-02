import { describe, expect, it } from 'vitest';
import { emptyData, type AppData, type Transaction } from '../data/types';
import { monthReport } from './report';

const tx = (date: string, amount: number, category: string): Transaction => ({ id: `${date}${amount}${category}`, date, description: category, amount, type: 'expense', category, source: 'manual' });
const today = new Date(2026, 10, 5); // October is complete

describe('monthReport', () => {
  const data: AppData = {
    ...emptyData(),
    incomes: [{ id: 'i', name: 'Salário', amount: 2000, frequency: 'monthly' }],
    expenses: [{ id: 'e', name: 'Renda', category: 'Habitação', amount: 800, frequency: 'monthly' }],
    transactions: [tx('2026-10-02', 250, 'Restauração'), tx('2026-10-05', 150, 'Compras'), tx('2026-09-03', 100, 'Restauração'), tx('2026-09-10', 100, 'Compras')],
    categoryBudgets: { Restauração: 200 },
    snapshots: [
      { month: '2026-09', income: 2000, outgoing: 1000, savings: 1000, investments: 0, assets: 0, debt: 0, netWorth: 1000 },
      { month: '2026-10', income: 2000, outgoing: 1200, savings: 800, investments: 0, assets: 0, debt: 0, netWorth: 1800 },
    ],
  };

  it('summarises income, spending and savings', () => {
    const r = monthReport(data, '2026-10', today);
    expect(r).toMatchObject({ income: 2000, fixed: 800, oneOff: 400, saved: 800, netWorthChange: 800 });
    expect(r.savingsRate).toBeCloseTo(0.4, 6);
    expect(r.topCategories[0]).toEqual(['Restauração', 250]);
    expect(r.biggestIncrease).toEqual({ category: 'Restauração', delta: 150 });
  });

  it('skips month-on-month comparisons while the month is in progress', () => {
    const r = monthReport(data, '2026-10', new Date(2026, 9, 20));
    expect(r.inProgress).toBe(true);
    expect(r.watch.join(' ')).not.toMatch(/acima do mês anterior|subiu/);
  });

  it('lists what went well and what to watch', () => {
    const r = monthReport(data, '2026-10', today);
    expect(r.good.join(' ')).toMatch(/40%/);
    expect(r.good.join(' ')).toMatch(/Património líquido subiu/);
    expect(r.watch.join(' ')).toMatch(/Orçamento de Restauração ultrapassado/);
    expect(r.watch.join(' ')).toMatch(/Gastos pontuais 100% acima/);
    expect(r.tips.join(' ')).toMatch(/Restauração foi 63%/);
  });
});
