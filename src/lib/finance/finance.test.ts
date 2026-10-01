import { describe, expect, it } from 'vitest';
import { amortizationSchedule, monthlyPayment } from './loan';
import { financialIndependenceTarget, projectGrowth } from './invest';
import { toMonthly } from './frequency';

describe('monthlyPayment', () => {
  it('matches the standard annuity formula', () => {
    // 150 000 € at 3% over 30 years → 632.41 €
    expect(monthlyPayment(150_000, 0.03, 360)).toBeCloseTo(632.41, 2);
  });

  it('handles zero interest', () => {
    expect(monthlyPayment(12_000, 0, 24)).toBe(500);
  });
});

describe('amortizationSchedule', () => {
  const terms = { principal: 100_000, annualRate: 0.04, months: 240 };

  it('pays off the loan exactly at term', () => {
    const s = amortizationSchedule(terms);
    expect(s.rows).toHaveLength(240);
    expect(s.rows.at(-1)!.balance).toBeCloseTo(0, 2);
    expect(s.totalPaid - s.totalInterest).toBeCloseTo(100_000, 2);
  });

  it('shortens the term when reducing term', () => {
    const base = amortizationSchedule(terms);
    const s = amortizationSchedule(terms, [{ month: 12, amount: 20_000, mode: 'term' }]);
    expect(s.rows.length).toBeLessThan(240);
    expect(s.totalInterest).toBeLessThan(base.totalInterest);
  });

  it('lowers the instalment but keeps the term when reducing payment', () => {
    const s = amortizationSchedule(terms, [{ month: 12, amount: 20_000, mode: 'payment' }]);
    expect(s.rows).toHaveLength(240);
    expect(s.rows[12].payment).toBeLessThan(s.rows[0].payment);
    expect(s.rows.at(-1)!.balance).toBeCloseTo(0, 2);
  });

  it('reducing term saves more interest than reducing payment', () => {
    const term = amortizationSchedule(terms, [{ month: 12, amount: 20_000, mode: 'term' }]);
    const pay = amortizationSchedule(terms, [{ month: 12, amount: 20_000, mode: 'payment' }]);
    expect(term.totalInterest).toBeLessThan(pay.totalInterest);
  });

  it('accounts for early-repayment fees', () => {
    const s = amortizationSchedule(terms, [{ month: 12, amount: 10_000, mode: 'term', feeRate: 0.005 }]);
    expect(s.totalFees).toBeCloseTo(50, 6);
  });
});

describe('projectGrowth', () => {
  it('grows only by contributions at 0% return', () => {
    const p = projectGrowth({ initial: 1000, monthlyContribution: 100, annualReturn: 0, years: 10 });
    expect(p.at(-1)!.value).toBeCloseTo(13_000, 6);
  });

  it('compounds to the expected annual return', () => {
    const p = projectGrowth({ initial: 10_000, monthlyContribution: 0, annualReturn: 0.07, years: 10 });
    expect(p.at(-1)!.value).toBeCloseTo(10_000 * 1.07 ** 10, 4);
  });
});

describe('helpers', () => {
  it('converts frequencies to monthly', () => {
    expect(toMonthly(120, 'annual')).toBe(10);
    expect(toMonthly(30, 'quarterly')).toBe(10);
  });

  it('computes the 4% rule target', () => {
    expect(financialIndependenceTarget(24_000)).toBe(600_000);
  });
});
