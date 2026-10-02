import type { Frequency } from '../lib/finance/frequency';

export interface Income {
  id: string;
  name: string;
  amount: number;
  frequency: Frequency;
}

export const EXPENSE_CATEGORIES = [
  'Habitação',
  'Alimentação',
  'Transportes',
  'Saúde',
  'Educação',
  'Seguros',
  'Impostos',
  'Lazer',
  'Outros',
] as const;

export interface Expense {
  id: string;
  name: string;
  category: string;
  amount: number;
  frequency: Frequency;
}

export const LOAN_TYPES = ['Habitação', 'Pessoal', 'Automóvel', 'Cartão de crédito', 'Outro'] as const;

export interface Loan {
  id: string;
  name: string;
  type: string;
  principal: number;
  /** TAN, e.g. 0.035 */
  annualRate: number;
  months: number;
  /** ISO date (YYYY-MM-DD) of the first instalment. */
  startDate: string;
}

export const SUBSCRIPTION_CATEGORIES = ['Streaming', 'Música', 'Software', 'Cloud', 'Ginásio', 'Telecomunicações', 'Notícias', 'Jogos', 'Outros'] as const;

export interface Subscription {
  id: string;
  name: string;
  category: string;
  amount: number;
  frequency: Frequency;
  /** ISO date of the next renewal. */
  nextRenewal: string;
  rarelyUsed: boolean;
}

export const ASSET_CLASSES = ['ETF', 'Ações', 'Fundos', 'PPR', 'Certificados', 'Depósitos', 'Cripto', 'Outro'] as const;

export interface Investment {
  id: string;
  name: string;
  assetClass: string;
  invested: number;
  currentValue: number;
  monthlyContribution: number;
  /** Optional market ticker (e.g. SXR8.DE); with `units`, the value follows the live price. */
  ticker?: string;
  units?: number;
}

/** Return assumptions derived from an ETF's history, used by the scenario presets. */
export interface MarketAssumptions {
  symbol: string;
  name: string;
  pessimistic: number;
  base: number;
  optimistic: number;
  /** Epoch ms when the analysis was applied. */
  appliedAt: number;
}

export type RuleBucket = 'needs' | 'wants';

/** Settings for the 50/30/20 plan. */
export interface BudgetRuleSettings {
  /** Cash already set aside for emergencies. */
  emergencyFund: number;
  /** Target size of the emergency fund, in months of essential spending. */
  emergencyMonths: number;
  /** Per-category overrides of the default needs/wants classification, keyed like `expense:Lazer`. */
  overrides?: Record<string, RuleBucket>;
}

export interface AppData {
  version: 1;
  /** Epoch ms of the last local change; used for last-write-wins sync. */
  updatedAt: number;
  incomes: Income[];
  expenses: Expense[];
  loans: Loan[];
  subscriptions: Subscription[];
  investments: Investment[];
  marketAssumptions?: MarketAssumptions;
  budgetRule?: BudgetRuleSettings;
}

export type Collection = 'incomes' | 'expenses' | 'loans' | 'subscriptions' | 'investments';

export function emptyData(): AppData {
  return { version: 1, updatedAt: 0, incomes: [], expenses: [], loans: [], subscriptions: [], investments: [] };
}
