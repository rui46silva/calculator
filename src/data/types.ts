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
  /** Optional next due date (YYYY-MM-DD); with it the expense shows up in the payment calendar. */
  dueDate?: string;
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

export const TRANSACTION_CATEGORIES = [
  'Restauração',
  'Supermercado',
  'Compras',
  'Lazer',
  'Transportes',
  'Saúde',
  'Casa',
  'Viagens',
  'Presentes',
  'Educação',
  'Outros',
] as const;

/** A one-off movement (dinner, shopping…) outside the recurring expenses. */
export interface Transaction {
  id: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  description: string;
  /** Always positive; `type` says which way the money went. */
  amount: number;
  type: 'expense' | 'income';
  category: string;
  note?: string;
  /** Where it came from: typed in, or imported from a bank statement (future AI import). */
  source: 'manual' | 'import';
  /** Identifier of the import batch, so a statement can be undone or de-duplicated. */
  importId?: string;
}

export interface Goal {
  id: string;
  name: string;
  icon: string;
  target: number;
  saved: number;
  /** YYYY-MM-DD */
  targetDate: string;
}

export const ASSET_TYPES = ['Imóvel', 'Automóvel', 'Conta bancária', 'Depósito a prazo', 'Certificados de aforro', 'Outro'] as const;

/** Things owned outside the investment portfolio (house, car, bank accounts). */
export interface Asset {
  id: string;
  name: string;
  type: string;
  value: number;
}

/** End-of-month picture of the finances, recorded automatically for the history chart. */
export interface Snapshot {
  /** YYYY-MM */
  month: string;
  income: number;
  outgoing: number;
  savings: number;
  investments: number;
  assets: number;
  debt: number;
  netWorth: number;
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
  transactions: Transaction[];
  goals: Goal[];
  assets: Asset[];
  snapshots?: Snapshot[];
  marketAssumptions?: MarketAssumptions;
  budgetRule?: BudgetRuleSettings;
  /** Monthly spending limit per one-off category. */
  categoryBudgets?: Record<string, number>;
  /** Recurring-movement suggestions the user chose to ignore (normalised descriptions). */
  dismissedRecurring?: string[];
}

export type Collection = 'incomes' | 'expenses' | 'loans' | 'subscriptions' | 'investments' | 'transactions' | 'goals' | 'assets';

export function emptyData(): AppData {
  return { version: 1, updatedAt: 0, incomes: [], expenses: [], loans: [], subscriptions: [], investments: [], transactions: [], goals: [], assets: [] };
}
