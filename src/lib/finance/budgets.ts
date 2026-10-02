import type { Transaction } from '../../data/types';
import { monthKey } from './transactions';

export const WARN_SHARE = 0.8;

export type BudgetLevel = 'ok' | 'warn' | 'over';

export interface BudgetStatus {
  category: string;
  limit: number;
  spent: number;
  share: number;
  /** Spending at the current pace by the end of the month (current month only). */
  projected: number;
  level: BudgetLevel;
}

function daysInMonth(key: string): number {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

/** Progress of each category budget in a month. Categories without a limit are left out. */
export function budgetStatus(
  transactions: Transaction[],
  budgets: Record<string, number> | undefined,
  key: string,
  today = new Date(),
): BudgetStatus[] {
  if (!budgets) return [];
  const spentBy = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== 'expense' || monthKey(t.date) !== key) continue;
    spentBy.set(t.category, (spentBy.get(t.category) ?? 0) + t.amount);
  }
  const isCurrent = key === monthKey(today);
  const elapsed = isCurrent ? today.getDate() : daysInMonth(key);
  const total = daysInMonth(key);

  return Object.entries(budgets)
    .filter(([, limit]) => limit > 0)
    .map(([category, limit]) => {
      const spent = spentBy.get(category) ?? 0;
      const share = spent / limit;
      return {
        category,
        limit,
        spent,
        share,
        projected: isCurrent ? (spent / elapsed) * total : spent,
        level: (share >= 1 ? 'over' : share >= WARN_SHARE ? 'warn' : 'ok') as BudgetLevel,
      };
    })
    .sort((a, b) => b.share - a.share);
}
