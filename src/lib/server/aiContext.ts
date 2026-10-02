import type { AppData } from '@/data/types';
import { toMonthly } from '@/lib/finance/frequency';
import { goalPlan } from '@/lib/finance/goals';
import { monthKey } from '@/lib/finance/transactions';
import { loanStatus, monthlySummary } from '@/lib/summary';

const MAX_MOVEMENTS = 300;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** A compact, plain-text picture of the user's finances for the assistant. */
export function buildContext(data: AppData, today = new Date()): string {
  const s = monthlySummary(data, today);
  const lines: string[] = [];
  const push = (title: string, rows: string[]) => {
    if (rows.length) lines.push(`## ${title}`, ...rows, '');
  };

  push('Data de hoje', [today.toISOString().slice(0, 10)]);
  push('Resumo mensal (€)', [
    `rendimento=${r2(s.income)}; despesas_fixas=${r2(s.expenses)}; subscrições=${r2(s.subscriptions)}; prestações=${r2(s.debt)}; pontuais_média_3m=${r2(s.oneOff)}; saldo=${r2(s.balance)}`,
    `investimentos=${r2(s.portfolioValue)}; bens=${r2(s.assets)}; dívida=${r2(s.debtBalance)}; património_líquido=${r2(s.netWorth)}`,
  ]);
  push('Rendimentos', data.incomes.map((i) => `${i.name}: ${i.amount} (${i.frequency})`));
  push('Despesas fixas', data.expenses.map((e) => `${e.name} [${e.category}]: ${e.amount} (${e.frequency}) ≈ ${r2(toMonthly(e.amount, e.frequency))}/mês`));
  push('Subscrições', data.subscriptions.map((x) => `${x.name} [${x.category}]: ${x.amount} (${x.frequency})${x.rarelyUsed ? ' — pouco usada' : ''}`));
  push(
    'Créditos',
    data.loans.map((l) => {
      const st = loanStatus(l, today);
      return `${l.name} [${l.type}]: TAN ${r2(l.annualRate * 100)}%, prestação ${r2(st.payment)}, em dívida ${r2(st.balance)}, faltam ${st.remainingMonths} meses`;
    }),
  );
  push('Investimentos', data.investments.map((i) => `${i.name} [${i.assetClass}${i.ticker ? `, ${i.ticker}` : ''}]: investido ${r2(i.invested)}, valor ${r2(i.currentValue)}, contribuição ${i.monthlyContribution}/mês`));
  push('Bens', (data.assets ?? []).map((a) => `${a.name} [${a.type}]: ${a.value}`));
  push('Metas', (data.goals ?? []).map((g) => {
    const p = goalPlan(g, today);
    return `${g.name}: ${g.saved} de ${g.target} até ${g.targetDate} (${p.status}, precisa ${r2(p.monthly)}/mês)`;
  }));
  push('Orçamentos mensais por categoria', Object.entries(data.categoryBudgets ?? {}).map(([c, v]) => `${c}: ${v}`));

  const tx = [...(data.transactions ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  const byMonth = new Map<string, Map<string, number>>();
  for (const t of tx) {
    if (t.type !== 'expense') continue;
    const m = monthKey(t.date);
    const cats = byMonth.get(m) ?? new Map<string, number>();
    cats.set(t.category, (cats.get(t.category) ?? 0) + t.amount);
    byMonth.set(m, cats);
  }
  push(
    'Gastos pontuais por mês e categoria',
    [...byMonth].slice(0, 24).map(([m, cats]) => `${m}: ${[...cats].map(([c, v]) => `${c} ${r2(v)}`).join(', ')}`),
  );
  push(
    `Movimentos (mais recentes primeiro${tx.length > MAX_MOVEMENTS ? `, ${MAX_MOVEMENTS} de ${tx.length}` : ''}) — data;descrição;categoria;valor`,
    tx.slice(0, MAX_MOVEMENTS).map((t) => `${t.date};${t.description.replace(/;/g, ',')};${t.category};${t.type === 'income' ? '+' : '-'}${t.amount}`),
  );
  return lines.join('\n');
}

export const ASSISTANT_SYSTEM = `És o assistente financeiro da app "Finanças". Respondes em português de Portugal, de forma clara e curta.
- Usa APENAS os dados do utilizador abaixo; se faltar informação, diz o que falta e onde a registar na app.
- Mostra as contas quando calculas (valores em euros, com 2 casas decimais).
- Podes explicar conceitos e sugerir passos prudentes, mas não és um consultor: não recomendes produtos financeiros específicos
  como se fosse aconselhamento personalizado e lembra riscos quando falares de investimentos.
- Formata com frases curtas e listas quando ajudar. Sem tabelas largas.`;
