import { describe, expect, it } from 'vitest';
import type { Transaction } from '../../data/types';
import { averageMonthly, averageMonthlyByCategory, monthKey, monthTotals, shiftMonth, suggestCategory } from './transactions';

const tx = (date: string, amount: number, category: string, type: Transaction['type'] = 'expense'): Transaction => ({
  id: `${date}-${amount}-${category}`,
  date,
  description: category,
  amount,
  type,
  category,
  source: 'manual',
});

describe('suggestCategory', () => {
  it('recognises common Portuguese merchants and words', () => {
    expect(suggestCategory('Jantar com amigos')).toBe('Restauração');
    expect(suggestCategory('Pingo Doce')).toBe('Supermercado');
    expect(suggestCategory('Uber para o aeroporto')).toBe('Transportes');
    expect(suggestCategory('Farmácia')).toBe('Saúde');
    expect(suggestCategory('Bilhete cinema')).toBe('Lazer');
    expect(suggestCategory('IKEA estante')).toBe('Compras');
    expect(suggestCategory('Hotel Porto')).toBe('Viagens');
    expect(suggestCategory('xyz')).toBeNull();
  });
});

describe('months', () => {
  it('builds and shifts month keys across years', () => {
    expect(monthKey('2026-10-02')).toBe('2026-10');
    expect(monthKey(new Date(2026, 0, 15))).toBe('2026-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });

  it('totals a month by category, ignoring other months and incomes', () => {
    const list = [
      tx('2026-10-01', 40, 'Restauração'),
      tx('2026-10-05', 25.5, 'Restauração'),
      tx('2026-10-07', 120, 'Compras'),
      tx('2026-10-08', 50, 'Outros', 'income'),
      tx('2026-09-30', 999, 'Compras'),
    ];
    const m = monthTotals(list, '2026-10');
    expect(m.spent).toBeCloseTo(185.5, 6);
    expect(m.received).toBe(50);
    expect(m.count).toBe(4);
    expect(m.byCategory).toEqual([
      ['Compras', 120],
      ['Restauração', 65.5],
    ]);
    expect(m.largest?.amount).toBe(120);
  });
});

describe('averageMonthly', () => {
  it('averages the last 90 days as three months', () => {
    const today = new Date(2026, 9, 2);
    const list = [tx('2026-10-01', 90, 'Restauração'), tx('2026-08-10', 210, 'Compras'), tx('2026-06-01', 1000, 'Viagens')];
    const by = averageMonthlyByCategory(list, today);
    expect(by.get('Restauração')).toBeCloseTo(30, 6);
    expect(by.get('Compras')).toBeCloseTo(70, 6);
    expect(by.has('Viagens')).toBe(false);
    expect(averageMonthly(list, today)).toBeCloseTo(100, 6);
  });

  it('includes today and excludes incomes', () => {
    const today = new Date(2026, 9, 2);
    expect(averageMonthly([tx('2026-10-02', 30, 'Lazer'), tx('2026-10-02', 300, 'Outros', 'income')], today)).toBeCloseTo(10, 6);
  });
});
