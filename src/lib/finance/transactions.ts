import type { AppData, Transaction } from '../../data/types';
import { normalizeDescription } from './recurring';

/** Names of fixed expenses and subscriptions, so movements already turned into them aren't counted twice. */
export function fixedNames(data: Pick<AppData, 'expenses' | 'subscriptions'>): Set<string> {
  return new Set([...data.expenses.map((e) => e.name), ...data.subscriptions.map((s) => s.name)].map(normalizeDescription));
}

/** Keyword → category hints for quick entry (and a baseline for the future statement import). */
const HINTS: [RegExp, string][] = [
  [/jantar|almo[cç]o|restaurante|caf[eé]|pastelaria|snack|bar\b|pizza|sushi|burger|mcdonald|kfc|uber ?eats|glovo|bolt food|takeaway/i, 'Restauração'],
  [/continente|pingo doce|lidl|aldi|mercadona|intermarch|minipre[cç]o|auchan|supermercado|mercearia|talho|padaria/i, 'Supermercado'],
  [/uber|bolt|taxi|t[aá]xi|combust[ií]vel|gasolina|gas[oó]leo|galp|bp\b|repsol|cepsa|portagem|via verde|estacionamento|comboio|cp\b|metro|autocarro|carris/i, 'Transportes'],
  [/farm[aá]cia|m[eé]dico|consulta|dentista|hospital|cl[ií]nica|an[aá]lises|[oó]tica/i, 'Saúde'],
  [/cinema|concerto|teatro|bilhete|museu|jogo|futebol|festival|bowling|discoteca/i, 'Lazer'],
  [/ikea|leroy|aki|worten|fnac|amazon|zara|primark|h&m|decathlon|roupa|sapatos|compras|loja/i, 'Compras'],
  [/hotel|airbnb|booking|voo|ryanair|tap\b|easyjet|viagem|f[eé]rias/i, 'Viagens'],
  [/presente|prenda|anivers[aá]rio|natal/i, 'Presentes'],
  [/livro|curso|propina|escola|forma[cç][aã]o|universidade/i, 'Educação'],
  [/limpeza|repara[cç][aã]o|canaliz|eletricista|casa|m[oó]veis|decora/i, 'Casa'],
];

export function suggestCategory(description: string): string | null {
  for (const [re, category] of HINTS) if (re.test(description)) return category;
  return null;
}

/** `YYYY-MM` for an ISO date or Date. */
export function monthKey(date: string | Date): string {
  if (typeof date === 'string') return date.slice(0, 7);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKey(d);
}

export interface MonthTotals {
  spent: number;
  received: number;
  count: number;
  byCategory: [string, number][];
  largest: Transaction | null;
}

export function monthTotals(transactions: Transaction[], key: string): MonthTotals {
  const inMonth = transactions.filter((t) => monthKey(t.date) === key);
  const expenses = inMonth.filter((t) => t.type === 'expense');
  const byCategory = new Map<string, number>();
  for (const t of expenses) byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amount);
  return {
    spent: expenses.reduce((a, t) => a + t.amount, 0),
    received: inMonth.filter((t) => t.type === 'income').reduce((a, t) => a + t.amount, 0),
    count: inMonth.length,
    byCategory: [...byCategory].sort((a, b) => b[1] - a[1]),
    largest: expenses.reduce<Transaction | null>((max, t) => (!max || t.amount > max.amount ? t : max), null),
  };
}

export const AVERAGE_WINDOW_DAYS = 90;

/**
 * Average monthly one-off spending per category over the last 90 days, so a single
 * expensive month doesn't swing the budget. Returns an empty map when there is no history.
 */
export function averageMonthlyByCategory(
  transactions: Transaction[],
  today = new Date(),
  /** Normalised descriptions already covered by a fixed expense or subscription (not one-off). */
  exclude?: Set<string>,
): Map<string, number> {
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const start = new Date(end.getTime() - AVERAGE_WINDOW_DAYS * 86_400_000);
  const months = AVERAGE_WINDOW_DAYS / 30;
  const out = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== 'expense') continue;
    if (exclude?.has(normalizeDescription(t.description))) continue;
    const d = new Date(`${t.date}T00:00:00`);
    if (d < start || d >= end) continue;
    out.set(t.category, (out.get(t.category) ?? 0) + t.amount / months);
  }
  return out;
}

export function averageMonthly(transactions: Transaction[], today = new Date(), exclude?: Set<string>): number {
  let total = 0;
  for (const v of averageMonthlyByCategory(transactions, today, exclude).values()) total += v;
  return total;
}
