import type { AppData, RuleBucket } from '../../data/types';
import { toMonthly } from './frequency';
import { loanStatus } from '../summary';

export const RULE = { needs: 0.5, wants: 0.3, savings: 0.2 } as const;

/** Debts at or above this TAN are worth paying down before investing. */
export const HIGH_INTEREST_RATE = 0.07;
/** While the emergency fund is incomplete, this share of savings goes to it. */
export const EMERGENCY_SHARE = 0.5;
/** While there is high-interest debt, this share of savings goes to early repayment. */
export const DEBT_SHARE = 0.3;

const DEFAULT_WANTS = new Set([
  'expense:Lazer',
  'expense:Outros',
  ...['Streaming', 'Música', 'Software', 'Cloud', 'Ginásio', 'Notícias', 'Jogos', 'Outros'].map((c) => `subscription:${c}`),
]);

/** Default 50/30/20 bucket for a spending line: essentials are needs, discretionary spending is wants. */
export function defaultBucket(key: string): RuleBucket {
  if (key.startsWith('loan:')) return 'needs';
  return DEFAULT_WANTS.has(key) ? 'wants' : 'needs';
}

export interface RuleLine {
  /** `expense:<category>`, `subscription:<category>` or `loan:<type>` */
  key: string;
  label: string;
  monthly: number;
  bucket: RuleBucket;
}

export interface RulePlan {
  income: number;
  lines: RuleLine[];
  actual: { needs: number; wants: number; savings: number };
  target: { needs: number; wants: number; savings: number };
  /** How much wants must be cut (and, failing that, needs) to reach the 20% savings target. */
  shortfall: number;
  /** Money set aside each month under the rule: the 20% target, or whatever is left if that's less. */
  savingsBudget: number;
  emergency: { target: number; current: number; gap: number; monthly: number; monthsToTarget: number | null };
  highInterestDebt: { name: string; rate: number; balance: number }[];
  debtExtra: number;
  /** The recommended monthly investment. */
  invest: number;
  /** Everything left after needs and wants, if the user wants to go beyond the rule. */
  maxInvest: number;
}

const SUB_LABEL = 'Subscrições · ';
const LOAN_LABEL = 'Prestação · ';

/** Applies the 50/30/20 rule to the user's data and works out a safe monthly investment. */
export function rulePlan(data: AppData, today = new Date()): RulePlan {
  const settings = data.budgetRule ?? { emergencyFund: 0, emergencyMonths: 6 };
  const overrides = settings.overrides ?? {};
  const bucketOf = (key: string) => overrides[key] ?? defaultBucket(key);

  const totals = new Map<string, { label: string; monthly: number }>();
  const add = (key: string, label: string, monthly: number) => {
    const t = totals.get(key) ?? { label, monthly: 0 };
    t.monthly += monthly;
    totals.set(key, t);
  };
  for (const e of data.expenses) add(`expense:${e.category}`, e.category, toMonthly(e.amount, e.frequency));
  for (const s of data.subscriptions) add(`subscription:${s.category}`, SUB_LABEL + s.category, toMonthly(s.amount, s.frequency));
  const statuses = data.loans.map((l) => ({ loan: l, status: loanStatus(l, today) }));
  for (const { loan, status } of statuses) if (status.active) add(`loan:${loan.type}`, LOAN_LABEL + loan.type, status.payment);

  const lines: RuleLine[] = [...totals]
    .map(([key, t]) => ({ key, label: t.label, monthly: t.monthly, bucket: bucketOf(key) }))
    .sort((a, b) => b.monthly - a.monthly);

  const income = data.incomes.reduce((a, i) => a + toMonthly(i.amount, i.frequency), 0);
  const needs = lines.filter((l) => l.bucket === 'needs').reduce((a, l) => a + l.monthly, 0);
  const wants = lines.filter((l) => l.bucket === 'wants').reduce((a, l) => a + l.monthly, 0);
  const surplus = income - needs - wants;
  const target = { needs: income * RULE.needs, wants: income * RULE.wants, savings: income * RULE.savings };

  const savingsBudget = Math.max(0, Math.min(target.savings, surplus));
  const shortfall = Math.max(0, target.savings - Math.max(0, surplus));

  const emergencyTarget = needs * settings.emergencyMonths;
  const emergencyGap = Math.max(0, emergencyTarget - settings.emergencyFund);
  const emergencyMonthly = emergencyGap > 0 ? Math.min(savingsBudget * EMERGENCY_SHARE, emergencyGap) : 0;

  const highInterestDebt = statuses
    .filter(({ loan, status }) => status.active && loan.annualRate >= HIGH_INTEREST_RATE)
    .map(({ loan, status }) => ({ name: loan.name, rate: loan.annualRate, balance: status.balance }))
    .sort((a, b) => b.rate - a.rate);
  const debtBalance = highInterestDebt.reduce((a, d) => a + d.balance, 0);
  const debtExtra = debtBalance > 0 ? Math.min(savingsBudget * DEBT_SHARE, debtBalance) : 0;

  const invest = Math.max(0, savingsBudget - emergencyMonthly - debtExtra);

  return {
    income,
    lines,
    actual: { needs, wants, savings: Math.max(0, surplus) },
    target,
    shortfall,
    savingsBudget,
    emergency: {
      target: emergencyTarget,
      current: settings.emergencyFund,
      gap: emergencyGap,
      monthly: emergencyMonthly,
      monthsToTarget: emergencyGap === 0 ? 0 : emergencyMonthly > 0 ? Math.ceil(emergencyGap / emergencyMonthly) : null,
    },
    highInterestDebt,
    debtExtra,
    invest,
    maxInvest: Math.max(0, surplus - emergencyMonthly - debtExtra),
  };
}
