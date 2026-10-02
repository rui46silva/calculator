import type { AppData } from '../../data/types';
import type { Frequency } from './frequency';

export interface PaymentEvent {
  /** YYYY-MM-DD */
  date: string;
  title: string;
  amount: number;
  kind: 'loan' | 'subscription' | 'expense';
  sourceId: string;
}

const STEP_MONTHS: Record<Exclude<Frequency, 'weekly'>, number> = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 };

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = (s: string) => new Date(`${s}T00:00:00`);

/** Same day `n` months later, clamped to the month's last day (31 Jan + 1 → 28/29 Feb). */
export function addMonths(date: Date, n: number, day = date.getDate()): Date {
  const target = new Date(date.getFullYear(), date.getMonth() + n, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, last));
  return target;
}

/** Every occurrence of a recurring date inside [from, to], given one known occurrence `anchor`. */
export function occurrences(anchor: string, frequency: Frequency, from: Date, to: Date): Date[] {
  const start = parse(anchor);
  if (Number.isNaN(start.getTime())) return [];
  const out: Date[] = [];
  if (frequency === 'weekly') {
    const week = 7 * 86_400_000;
    const k = Math.ceil((from.getTime() - start.getTime()) / week);
    for (let t = start.getTime() + k * week; t <= to.getTime(); t += week) out.push(new Date(t));
    return out;
  }
  const step = STEP_MONTHS[frequency];
  const day = start.getDate();
  const monthsBetween = (from.getFullYear() - start.getFullYear()) * 12 + (from.getMonth() - start.getMonth());
  let k = Math.floor(monthsBetween / step) - 1;
  for (let d = addMonths(start, k * step, day); d <= to; k++, d = addMonths(start, k * step, day)) {
    if (d >= from) out.push(d);
  }
  return out;
}

/** All known payments between two dates (inclusive), sorted by date. */
export function upcomingPayments(data: AppData, from: Date, to: Date): PaymentEvent[] {
  const f = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const t = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  const events: PaymentEvent[] = [];

  for (const loan of data.loans) {
    const start = parse(loan.startDate);
    const last = addMonths(start, loan.months - 1);
    const payment = loan.annualRate === 0 ? loan.principal / loan.months : (loan.principal * (loan.annualRate / 12)) / (1 - Math.pow(1 + loan.annualRate / 12, -loan.months));
    for (const d of occurrences(loan.startDate, 'monthly', f, t)) {
      if (d < start || d > last) continue;
      events.push({ date: iso(d), title: loan.name, amount: payment, kind: 'loan', sourceId: loan.id });
    }
  }
  for (const s of data.subscriptions) {
    if (!s.nextRenewal) continue;
    for (const d of occurrences(s.nextRenewal, s.frequency, f, t)) {
      events.push({ date: iso(d), title: s.name, amount: s.amount, kind: 'subscription', sourceId: s.id });
    }
  }
  for (const e of data.expenses) {
    if (!e.dueDate) continue;
    for (const d of occurrences(e.dueDate, e.frequency, f, t)) {
      events.push({ date: iso(d), title: e.name, amount: e.amount, kind: 'expense', sourceId: e.id });
    }
  }
  return events.sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount);
}
