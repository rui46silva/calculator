import type { AppData, Transaction } from '../../data/types';
const monthKey = (iso: string) => iso.slice(0, 7);

export interface RecurringSuggestion {
  key: string;
  description: string;
  category: string;
  averageAmount: number;
  months: number;
  lastDate: string;
  /** Stable small amounts look like subscriptions; the rest like fixed expenses. */
  suggestion: 'subscription' | 'expense';
}

const LOOKBACK_MONTHS = 6;
const MIN_MONTHS = 3;
const MAX_VARIATION = 0.2;

/** Normalised description used to group the same merchant across months. */
export function normalizeDescription(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[0-9]+/g, ' ')
    .replace(/[^a-z ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Finds one-off movements that repeat every month with a similar amount (e.g. a gym or
 * streaming charge typed in Movimentos), so they can be turned into fixed expenses or subscriptions.
 */
export function detectRecurring(data: AppData, today = new Date()): RecurringSuggestion[] {
  const since = new Date(today.getFullYear(), today.getMonth() - LOOKBACK_MONTHS + 1, 1);
  const known = new Set([...data.expenses.map((e) => e.name), ...data.subscriptions.map((s) => s.name)].map(normalizeDescription));
  const dismissed = new Set(data.dismissedRecurring ?? []);

  const groups = new Map<string, Transaction[]>();
  for (const t of data.transactions ?? []) {
    if (t.type !== 'expense' || new Date(`${t.date}T00:00:00`) < since) continue;
    const key = normalizeDescription(t.description);
    if (key.length < 3 || known.has(key) || dismissed.has(key)) continue;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }

  const out: RecurringSuggestion[] = [];
  for (const [key, list] of groups) {
    const months = new Set(list.map((t) => monthKey(t.date)));
    if (months.size < MIN_MONTHS) continue;
    const amounts = list.map((t) => t.amount);
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const sd = Math.sqrt(amounts.reduce((a, b) => a + (b - mean) ** 2, 0) / amounts.length);
    if (mean <= 0 || sd / mean > MAX_VARIATION) continue;
    const latest = [...list].sort((a, b) => b.date.localeCompare(a.date))[0];
    out.push({
      key,
      description: latest.description,
      category: latest.category,
      averageAmount: Math.round(mean * 100) / 100,
      months: months.size,
      lastDate: latest.date,
      suggestion: sd / mean < 0.05 && mean < 100 ? 'subscription' : 'expense',
    });
  }
  return out.sort((a, b) => b.averageAmount - a.averageAmount);
}
