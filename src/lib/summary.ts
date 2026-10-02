import type { AppData, Loan, Snapshot } from '../data/types';
import { toMonthly } from './finance/frequency';
import { amortizationSchedule, monthlyPayment } from './finance/loan';
import { averageMonthly, fixedNames } from './finance/transactions';

/** Number of instalments already paid on `today`, counting the start month as the first. */
export function monthsElapsed(startDate: string, today = new Date()): number {
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return 0;
  const months = (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth());
  return Math.max(0, months + (today.getDate() >= start.getDate() ? 1 : 0));
}

export interface LoanStatus {
  payment: number;
  balance: number;
  remainingMonths: number;
  active: boolean;
}

export function loanStatus(loan: Loan, today = new Date()): LoanStatus {
  const payment = monthlyPayment(loan.principal, loan.annualRate, loan.months);
  const paid = Math.min(monthsElapsed(loan.startDate, today), loan.months);
  const { rows } = amortizationSchedule(loan);
  const balance = paid === 0 ? loan.principal : (rows[paid - 1]?.balance ?? 0);
  const remainingMonths = loan.months - paid;
  // A loan that only starts in a later month has no instalment yet.
  const started = loan.startDate.slice(0, 7) <= `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  return { payment, balance, remainingMonths, active: started && remainingMonths > 0 && balance > 0.005 };
}

export interface MonthlySummary {
  income: number;
  expenses: number;
  subscriptions: number;
  /** Average monthly one-off spending (last 90 days). */
  oneOff: number;
  debt: number;
  balance: number;
  debtBalance: number;
  invested: number;
  portfolioValue: number;
  /** House, car, bank accounts… */
  assets: number;
  netWorth: number;
}

export function monthlySummary(data: AppData, today = new Date()): MonthlySummary {
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const income = sum(data.incomes.map((i) => toMonthly(i.amount, i.frequency)));
  const expenses = sum(data.expenses.map((e) => toMonthly(e.amount, e.frequency)));
  const subscriptions = sum(data.subscriptions.map((s) => toMonthly(s.amount, s.frequency)));
  const oneOff = averageMonthly(data.transactions ?? [], today, fixedNames(data));
  const statuses = data.loans.map((l) => loanStatus(l, today));
  const debt = sum(statuses.filter((s) => s.active).map((s) => s.payment));
  const debtBalance = sum(statuses.map((s) => s.balance));
  const invested = sum(data.investments.map((i) => i.invested));
  const portfolioValue = sum(data.investments.map((i) => i.currentValue));
  const assets = sum((data.assets ?? []).map((a) => a.value));
  return {
    income,
    expenses,
    subscriptions,
    oneOff,
    debt,
    balance: income - expenses - subscriptions - oneOff - debt,
    debtBalance,
    invested,
    portfolioValue,
    assets,
    netWorth: portfolioValue + assets - debtBalance,
  };
}

export interface ScenarioInput {
  years: number;
  /** Annual inflation applied to expenses and subscriptions. */
  inflation: number;
  /** Annual growth of income. */
  incomeGrowth: number;
  /** Expected annual return on the investment portfolio. */
  investmentReturn: number;
  /** Share (0–1) of each year's surplus that is invested. */
  investShare: number;
}

export interface ScenarioYear {
  year: number;
  income: number;
  expenses: number;
  debtPayments: number;
  surplus: number;
  debtBalance: number;
  portfolio: number;
  cash: number;
  netWorth: number;
}

/** Year-by-year projection of the current situation. Loans follow their amortization schedules. */
export function projectScenario(data: AppData, input: ScenarioInput, today = new Date()): ScenarioYear[] {
  const base = monthlySummary(data, today);
  const schedules = data.loans.map((l) => ({
    rows: amortizationSchedule(l).rows,
    paid: Math.min(monthsElapsed(l.startDate, today), l.months),
  }));
  const monthlyContribution = data.investments.reduce((a, i) => a + i.monthlyContribution, 0);
  const monthlyReturn = Math.pow(1 + input.investmentReturn, 1 / 12) - 1;

  let portfolio = base.portfolioValue;
  let cash = 0;
  const years: ScenarioYear[] = [];

  for (let y = 1; y <= input.years; y++) {
    const income = base.income * 12 * Math.pow(1 + input.incomeGrowth, y - 1);
    const expenses = (base.expenses + base.subscriptions + base.oneOff) * 12 * Math.pow(1 + input.inflation, y - 1);

    let debtPayments = 0;
    let debtBalance = 0;
    for (const s of schedules) {
      const from = s.paid + (y - 1) * 12;
      const yearRows = s.rows.slice(from, from + 12);
      debtPayments += yearRows.reduce((a, r) => a + r.payment, 0);
      const last = s.rows[Math.min(from + 12, s.rows.length) - 1];
      debtBalance += from + 12 <= s.rows.length ? (last?.balance ?? 0) : 0;
    }

    const surplus = income - expenses - debtPayments;
    const toInvest = Math.max(surplus, 0) * input.investShare;
    const monthlyIn = monthlyContribution + toInvest / 12;
    for (let m = 0; m < 12; m++) portfolio = portfolio * (1 + monthlyReturn) + monthlyIn;
    cash += surplus - toInvest - monthlyContribution * 12;

    years.push({
      year: today.getFullYear() + y - 1,
      income,
      expenses,
      debtPayments,
      surplus,
      debtBalance,
      portfolio,
      cash,
      netWorth: portfolio + cash - debtBalance,
    });
  }
  return years;
}

/** The current month's snapshot for the history chart. */
export function currentSnapshot(data: AppData, today = new Date()): Snapshot {
  const s = monthlySummary(data, today);
  const r = (n: number) => Math.round(n * 100) / 100;
  const outgoing = s.expenses + s.subscriptions + s.oneOff + s.debt;
  return {
    month: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`,
    income: r(s.income),
    outgoing: r(outgoing),
    savings: r(s.income - outgoing),
    investments: r(s.portfolioValue),
    assets: r(s.assets),
    debt: r(s.debtBalance),
    netWorth: r(s.netWorth),
  };
}

/** Snapshots with the current month inserted or refreshed; returns null when nothing changed. */
export function withCurrentSnapshot(data: AppData, today = new Date()): Snapshot[] | null {
  const snap = currentSnapshot(data, today);
  const list = data.snapshots ?? [];
  const existing = list.find((x) => x.month === snap.month);
  if (existing && JSON.stringify(existing) === JSON.stringify(snap)) return null;
  return [...list.filter((x) => x.month !== snap.month), snap].sort((a, b) => a.month.localeCompare(b.month));
}
