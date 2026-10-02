import type { AppData } from '../data/types';
import { budgetStatus } from './finance/budgets';
import { upcomingPayments } from './finance/calendar';
import { goalPlan } from './finance/goals';
import { monthKey } from './finance/transactions';

export interface Reminder {
  /** Stable per event and day, so each reminder is shown once. */
  key: string;
  title: string;
  body: string;
  url: string;
}

const eur = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' });

/** Things worth a notification today: payments due today/tomorrow, budgets at 80%+, overdue goals. */
export function remindersFor(data: AppData, today = new Date()): Reminder[] {
  const day = `${monthKey(today)}-${String(today.getDate()).padStart(2, '0')}`;
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const out: Reminder[] = [];

  for (const e of upcomingPayments(data, today, tomorrow)) {
    const when = e.date === day ? 'hoje' : 'amanhã';
    out.push({ key: `pay:${e.sourceId}:${e.date}`, title: `Pagamento ${when}: ${e.title}`, body: `${eur.format(e.amount)} a ${when}.`, url: '/calendario' });
  }
  for (const b of budgetStatus(data.transactions ?? [], data.categoryBudgets, monthKey(today), today)) {
    if (b.level === 'ok') continue;
    out.push({
      key: `budget:${b.category}:${monthKey(today)}:${b.level}`,
      title: b.level === 'over' ? `Orçamento ultrapassado: ${b.category}` : `Perto do limite: ${b.category}`,
      body: `${eur.format(b.spent)} de ${eur.format(b.limit)} este mês.`,
      url: '/movimentos',
    });
  }
  for (const g of data.goals ?? []) {
    if (goalPlan(g, today).status === 'overdue') out.push({ key: `goal:${g.id}:${day}`, title: `Meta fora de prazo: ${g.name}`, body: 'Atualiza a data ou o valor da meta.', url: '/metas' });
  }
  return out;
}
