import { describe, expect, it } from 'vitest';
import { emptyData, type AppData } from '../data/types';
import { loanStatus, monthlySummary, monthsElapsed, projectScenario } from './summary';

const today = new Date(2026, 9, 15); // 15 Oct 2026

describe('monthsElapsed', () => {
  it('counts instalments paid, including the current month once its day has passed', () => {
    expect(monthsElapsed('2026-10-01', today)).toBe(1);
    expect(monthsElapsed('2026-10-20', today)).toBe(0);
    expect(monthsElapsed('2025-10-01', today)).toBe(13);
    expect(monthsElapsed('2030-01-01', today)).toBe(0);
  });
});

describe('loanStatus', () => {
  it('reports a finished loan as inactive with zero balance', () => {
    const s = loanStatus(
      { id: '1', name: 'Carro', type: 'Automóvel', principal: 10_000, annualRate: 0.05, months: 12, startDate: '2020-01-01' },
      today,
    );
    expect(s.active).toBe(false);
    expect(s.balance).toBeCloseTo(0, 2);
  });
});

describe('monthlySummary', () => {
  it('normalises frequencies and nets everything out', () => {
    const data: AppData = {
      ...emptyData(),
      incomes: [{ id: 'i', name: 'Salário', amount: 2000, frequency: 'monthly' }],
      expenses: [{ id: 'e', name: 'Seguro', category: 'Seguros', amount: 240, frequency: 'annual' }],
      subscriptions: [
        { id: 's', name: 'Streaming', category: 'Lazer', amount: 10, frequency: 'monthly', nextRenewal: '', rarelyUsed: false },
      ],
    };
    const s = monthlySummary(data, today);
    expect(s.expenses).toBe(20);
    expect(s.balance).toBe(1970);
  });
});

describe('projectScenario', () => {
  it('accumulates surplus as cash when nothing is invested', () => {
    const data: AppData = {
      ...emptyData(),
      incomes: [{ id: 'i', name: 'Salário', amount: 1000, frequency: 'monthly' }],
      expenses: [{ id: 'e', name: 'Renda', category: 'Habitação', amount: 600, frequency: 'monthly' }],
    };
    const years = projectScenario(data, { years: 3, inflation: 0, incomeGrowth: 0, investmentReturn: 0, investShare: 0 }, today);
    expect(years).toHaveLength(3);
    expect(years[2].cash).toBeCloseTo(4800 * 3, 6);
    expect(years[2].netWorth).toBeCloseTo(14_400, 6);
  });

  it('stops counting loan payments once the loan is paid off', () => {
    const data: AppData = {
      ...emptyData(),
      loans: [{ id: 'l', name: 'Pessoal', type: 'Pessoal', principal: 12_000, annualRate: 0, months: 18, startDate: '2026-11-01' }],
    };
    const years = projectScenario(data, { years: 3, inflation: 0, incomeGrowth: 0, investmentReturn: 0, investShare: 0 }, today);
    expect(years[0].debtPayments).toBeCloseTo(8000, 6);
    expect(years[1].debtPayments).toBeCloseTo(4000, 6);
    expect(years[1].debtBalance).toBe(0);
    expect(years[2].debtPayments).toBe(0);
  });
});
