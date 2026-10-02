import { describe, expect, it } from 'vitest';
import { emptyData, type AppData } from '../../data/types';
import { defaultBucket, rulePlan } from './budgetRule';
import { rollingReturns } from './market';

const today = new Date(2026, 9, 2);

function data(extra: Partial<AppData> = {}): AppData {
  return {
    ...emptyData(),
    incomes: [{ id: 'i', name: 'Salário', amount: 2000, frequency: 'monthly' }],
    expenses: [
      { id: 'e1', name: 'Renda', category: 'Habitação', amount: 700, frequency: 'monthly' },
      { id: 'e2', name: 'Super', category: 'Alimentação', amount: 250, frequency: 'monthly' },
      { id: 'e3', name: 'Jantares', category: 'Lazer', amount: 200, frequency: 'monthly' },
      { id: 'e4', name: 'IUC', category: 'Impostos', amount: 120, frequency: 'annual' },
    ],
    subscriptions: [
      { id: 's1', name: 'Netflix', category: 'Streaming', amount: 15, frequency: 'monthly', nextRenewal: '', rarelyUsed: false },
      { id: 's2', name: 'Telemóvel', category: 'Telecomunicações', amount: 25, frequency: 'monthly', nextRenewal: '', rarelyUsed: false },
    ],
    ...extra,
  };
}

describe('defaultBucket', () => {
  it('treats essentials and loan payments as needs, leisure and most subscriptions as wants', () => {
    expect(defaultBucket('expense:Habitação')).toBe('needs');
    expect(defaultBucket('expense:Lazer')).toBe('wants');
    expect(defaultBucket('subscription:Telecomunicações')).toBe('needs');
    expect(defaultBucket('subscription:Streaming')).toBe('wants');
    expect(defaultBucket('loan:Pessoal')).toBe('needs');
  });
});

describe('rulePlan', () => {
  it('splits spending into needs and wants and computes the 20% target', () => {
    const p = rulePlan(data({ budgetRule: { emergencyFund: 1_000_000, emergencyMonths: 6 } }), today);
    expect(p.income).toBe(2000);
    expect(p.actual.needs).toBeCloseTo(700 + 250 + 10 + 25, 6);
    expect(p.actual.wants).toBeCloseTo(215, 6);
    expect(p.target).toEqual({ needs: 1000, wants: 600, savings: 400 });
    expect(p.savingsBudget).toBe(400);
    expect(p.shortfall).toBe(0);
    // Emergency fund complete and no expensive debt: invest the whole 20%.
    expect(p.invest).toBe(400);
    expect(p.maxInvest).toBeCloseTo(2000 - 985 - 215, 6);
  });

  it('sends half of the savings to an incomplete emergency fund', () => {
    const p = rulePlan(data({ budgetRule: { emergencyFund: 1000, emergencyMonths: 6 } }), today);
    expect(p.emergency.target).toBeCloseTo(985 * 6, 6);
    expect(p.emergency.monthly).toBe(200);
    expect(p.emergency.monthsToTarget).toBe(Math.ceil((985 * 6 - 1000) / 200));
    expect(p.invest).toBe(200);
  });

  it('puts part of the savings towards high-interest debt', () => {
    const p = rulePlan(
      data({
        budgetRule: { emergencyFund: 1_000_000, emergencyMonths: 6 },
        loans: [{ id: 'l', name: 'Cartão', type: 'Cartão de crédito', principal: 3000, annualRate: 0.16, months: 24, startDate: '2026-06-01' }],
      }),
      today,
    );
    expect(p.highInterestDebt).toHaveLength(1);
    expect(p.debtExtra).toBeCloseTo(p.savingsBudget * 0.3, 6);
    expect(p.invest).toBeCloseTo(p.savingsBudget * 0.7, 6);
  });

  it('reports the shortfall when spending leaves less than 20%', () => {
    const p = rulePlan(
      data({ expenses: [{ id: 'e', name: 'Renda', category: 'Habitação', amount: 1800, frequency: 'monthly' }], subscriptions: [] }),
      today,
    );
    expect(p.savingsBudget).toBe(200);
    expect(p.shortfall).toBe(200);
  });

  it('honours category overrides', () => {
    const p = rulePlan(data({ budgetRule: { emergencyFund: 0, emergencyMonths: 6, overrides: { 'expense:Lazer': 'needs' } } }), today);
    expect(p.lines.find((l) => l.key === 'expense:Lazer')?.bucket).toBe('needs');
    expect(p.actual.wants).toBeCloseTo(15, 6);
  });

  it('counts one-off spending (90-day average) in the right bucket', () => {
    const p = rulePlan(
      data({
        budgetRule: { emergencyFund: 1_000_000, emergencyMonths: 6 },
        transactions: [
          { id: 't1', date: '2026-09-20', description: 'Jantar', amount: 150, type: 'expense', category: 'Restauração', source: 'manual' },
          { id: 't2', date: '2026-09-21', description: 'Pingo Doce', amount: 60, type: 'expense', category: 'Supermercado', source: 'manual' },
        ],
      }),
      today,
    );
    expect(p.lines.find((l) => l.key === 'transaction:Restauração')).toMatchObject({ monthly: 50, bucket: 'wants' });
    expect(p.lines.find((l) => l.key === 'transaction:Supermercado')).toMatchObject({ monthly: 20, bucket: 'needs' });
    expect(p.actual.wants).toBeCloseTo(215 + 50, 6);
  });

  it('handles no income without dividing by zero', () => {
    const p = rulePlan(emptyData(), today);
    expect(p.invest).toBe(0);
    expect(p.emergency.monthsToTarget).toBe(0);
  });
});

describe('rollingReturns', () => {
  it('counts losing holding periods', () => {
    // 100 → 200 over 2 years, then back to 100 over 2 years.
    const closes = [...Array.from({ length: 25 }, (_, i) => 100 * 2 ** (i / 24)), ...Array.from({ length: 24 }, (_, i) => 200 * 0.5 ** ((i + 1) / 24))];
    const r = rollingReturns(closes.map((close, i) => ({ t: i, close })), 2)!;
    expect(r.windows).toBe(25);
    expect(r.best).toBeCloseTo(Math.SQRT2 - 1, 10);
    expect(r.worst).toBeCloseTo(Math.SQRT1_2 - 1, 10);
    expect(r.lossShare).toBeGreaterThan(0);
  });

  it('returns null when the series is shorter than the window', () => {
    expect(rollingReturns([{ t: 0, close: 1 }, { t: 1, close: 2 }], 1)).toBeNull();
  });
});
