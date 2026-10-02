import type { AppData } from '../data/types';
import { budgetStatus } from './finance/budgets';
import { goalPlan } from './finance/goals';
import { monthKey, monthTotals, shiftMonth } from './finance/transactions';
import { monthlySummary } from './summary';

export interface MonthReport {
  month: string;
  /** The month hasn't ended: comparisons with the previous month are skipped. */
  inProgress: boolean;
  income: number;
  /** Fixed expenses, subscriptions and loan instalments for a month. */
  fixed: number;
  oneOff: number;
  saved: number;
  savingsRate: number;
  topCategories: [string, number][];
  /** Category with the largest increase vs the previous month. */
  biggestIncrease: { category: string; delta: number } | null;
  netWorth: number | null;
  netWorthChange: number | null;
  good: string[];
  watch: string[];
  tips: string[];
}

const eur = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' });
const pct = new Intl.NumberFormat('pt-PT', { style: 'percent', maximumFractionDigits: 0 });

/** A deterministic month review built only from the user's data (no AI needed). */
export function monthReport(data: AppData, key: string, today = new Date()): MonthReport {
  const s = monthlySummary(data, today);
  const fixed = s.expenses + s.subscriptions + s.debt;
  const current = monthTotals(data.transactions ?? [], key);
  const previous = monthTotals(data.transactions ?? [], shiftMonth(key, -1));
  const income = s.income + current.received;
  const saved = income - fixed - current.spent;
  const savingsRate = income > 0 ? saved / income : 0;

  const prevBy = new Map(previous.byCategory);
  let biggestIncrease: MonthReport['biggestIncrease'] = null;
  for (const [category, amount] of current.byCategory) {
    const delta = amount - (prevBy.get(category) ?? 0);
    if (delta > 0 && (!biggestIncrease || delta > biggestIncrease.delta)) biggestIncrease = { category, delta };
  }

  const snaps = data.snapshots ?? [];
  const snap = snaps.find((x) => x.month === key);
  const prevSnap = snaps.find((x) => x.month === shiftMonth(key, -1));

  const good: string[] = [];
  const watch: string[] = [];
  const tips: string[] = [];

  if (savingsRate >= 0.2) good.push(`Poupaste ${pct.format(savingsRate)} do rendimento — acima dos 20% recomendados.`);
  else if (saved > 0) watch.push(`Poupaste ${pct.format(savingsRate)} do rendimento; o objetivo é 20%.`);
  else if (income > 0) watch.push(`Gastaste mais ${eur.format(-saved)} do que ganhaste este mês.`);

  const inProgress = key >= monthKey(today);
  if (!inProgress && previous.spent > 0) {
    const change = current.spent / previous.spent - 1;
    if (change <= -0.1) good.push(`Gastos pontuais ${pct.format(-change)} abaixo do mês anterior.`);
    else if (change >= 0.15) watch.push(`Gastos pontuais ${pct.format(change)} acima do mês anterior.`);
  }
  if (!inProgress && biggestIncrease && biggestIncrease.delta >= 30) watch.push(`${biggestIncrease.category} subiu ${eur.format(biggestIncrease.delta)} face ao mês anterior.`);

  const budgets = budgetStatus(data.transactions ?? [], data.categoryBudgets, key, today);
  const over = budgets.filter((b) => b.level === 'over');
  const kept = budgets.filter((b) => b.level !== 'over');
  for (const b of over) watch.push(`Orçamento de ${b.category} ultrapassado: ${eur.format(b.spent)} de ${eur.format(b.limit)}.`);
  if (budgets.length && !over.length) good.push(`Todos os orçamentos (${kept.length}) dentro do limite.`);

  for (const g of data.goals ?? []) {
    const p = goalPlan(g, today);
    if (p.status === 'done') good.push(`Meta "${g.name}" atingida.`);
    else if (p.status === 'overdue') watch.push(`Meta "${g.name}" passou do prazo; faltam ${eur.format(p.remaining)}.`);
  }

  if (snap && prevSnap) {
    const d = snap.netWorth - prevSnap.netWorth;
    (d >= 0 ? good : watch).push(`Património líquido ${d >= 0 ? 'subiu' : 'desceu'} ${eur.format(Math.abs(d))}.`);
  }

  const top = current.byCategory[0];
  if (top && current.spent > 0 && top[1] / current.spent > 0.4) tips.push(`${top[0]} foi ${pct.format(top[1] / current.spent)} dos gastos pontuais: um limite mensal nesta categoria ajuda.`);
  const rarely = data.subscriptions.filter((x) => x.rarelyUsed);
  if (rarely.length) tips.push(`Cancelar ${rarely.map((x) => x.name).join(', ')} (pouco usadas) liberta dinheiro todos os meses.`);
  if (savingsRate < 0.2 && income > 0) tips.push(`Para chegar aos 20% faltam ${eur.format(income * 0.2 - Math.max(saved, 0))} por mês — vê o Plano 50/30/20.`);
  if (!budgets.length && current.count > 5) tips.push('Define limites por categoria em Movimentos para receber avisos antes de exagerar.');

  return {
    month: key,
    inProgress,
    income,
    fixed,
    oneOff: current.spent,
    saved,
    savingsRate,
    topCategories: current.byCategory.slice(0, 3),
    biggestIncrease,
    netWorth: snap?.netWorth ?? null,
    netWorthChange: snap && prevSnap ? snap.netWorth - prevSnap.netWorth : null,
    good,
    watch,
    tips,
  };
}

export function currentMonthKey(today = new Date()): string {
  return monthKey(today);
}
