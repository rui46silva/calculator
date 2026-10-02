'use client';

import { useSearchParams } from 'next/navigation';
import { useStore } from '../data/store';
import { monthReport } from '../lib/report';
import { budgetStatus } from '../lib/finance/budgets';
import { goalPlan } from '../lib/finance/goals';
import { monthKey, monthTotals } from '../lib/finance/transactions';
import { monthlySummary } from '../lib/summary';
import { date, money, percent } from '../lib/format';

const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
};

/** A printable monthly report: the browser's "Guardar como PDF" turns it into a PDF. */
export function PrintReport() {
  const { data, user } = useStore();
  const params = useSearchParams();
  const raw = params.get('mes') ?? '';
  const month = /^\d{4}-\d{2}$/.test(raw) ? raw : monthKey(new Date());
  const r = monthReport(data, month);
  const s = monthlySummary(data);
  const totals = monthTotals(data.transactions ?? [], month);
  const budgets = budgetStatus(data.transactions ?? [], data.categoryBudgets, month);
  const movements = (data.transactions ?? []).filter((t) => monthKey(t.date) === month).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <article className="print-report">
      <div className="no-print print-actions">
        <button className="primary" onClick={() => window.print()}>
          Imprimir / Guardar PDF
        </button>
        <span className="muted small">No diálogo de impressão escolhe “Guardar como PDF”.</span>
      </div>

      <header>
        <h1>Relatório de {monthLabel(month)}</h1>
        <p className="muted">
          {user.name || user.email} · gerado a {new Date().toLocaleDateString('pt-PT')}
        </p>
      </header>

      <section>
        <h2>Resumo</h2>
        <table>
          <tbody>
            <tr><td>Rendimento</td><td className="num">{money(r.income)}</td></tr>
            <tr><td>Despesas fixas, subscrições e prestações</td><td className="num">{money(r.fixed)}</td></tr>
            <tr><td>Gastos pontuais</td><td className="num">{money(r.oneOff)}</td></tr>
            <tr><td><strong>Poupança</strong></td><td className="num"><strong>{money(r.saved)} ({percent(r.savingsRate)})</strong></td></tr>
            <tr><td>Património líquido</td><td className="num">{money(r.netWorth ?? s.netWorth)}</td></tr>
          </tbody>
        </table>
      </section>

      {(r.good.length > 0 || r.watch.length > 0 || r.tips.length > 0) && (
        <section>
          <h2>Análise</h2>
          {r.good.length > 0 && (<><h3>Correu bem</h3><ul>{r.good.map((t) => <li key={t}>{t}</li>)}</ul></>)}
          {r.watch.length > 0 && (<><h3>A ter atenção</h3><ul>{r.watch.map((t) => <li key={t}>{t}</li>)}</ul></>)}
          {r.tips.length > 0 && (<><h3>Sugestões</h3><ul>{r.tips.map((t) => <li key={t}>{t}</li>)}</ul></>)}
        </section>
      )}

      {totals.byCategory.length > 0 && (
        <section>
          <h2>Gastos pontuais por categoria</h2>
          <table>
            <thead><tr><th>Categoria</th><th className="num">Valor</th><th className="num">Orçamento</th></tr></thead>
            <tbody>
              {totals.byCategory.map(([c, v]) => {
                const b = budgets.find((x) => x.category === c);
                return (
                  <tr key={c}>
                    <td>{c}</td>
                    <td className="num">{money(v)}</td>
                    <td className="num">{b ? `${money(b.limit)} (${percent(b.share)})` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {(data.goals ?? []).length > 0 && (
        <section>
          <h2>Metas</h2>
          <table>
            <thead><tr><th>Meta</th><th className="num">Poupado</th><th className="num">Objetivo</th><th className="num">Por mês</th></tr></thead>
            <tbody>
              {(data.goals ?? []).map((g) => {
                const p = goalPlan(g);
                return (
                  <tr key={g.id}>
                    <td>{g.name} (até {date(g.targetDate)})</td>
                    <td className="num">{money(g.saved)}</td>
                    <td className="num">{money(g.target)}</td>
                    <td className="num">{p.status === 'done' ? 'Concluída' : money(p.monthly)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {movements.length > 0 && (
        <section className="page-break">
          <h2>Movimentos ({movements.length})</h2>
          <table className="dense">
            <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th className="num">Valor</th></tr></thead>
            <tbody>
              {movements.map((t) => (
                <tr key={t.id}>
                  <td>{date(t.date)}</td>
                  <td>{t.description}</td>
                  <td>{t.category}</td>
                  <td className="num">{t.type === 'income' ? '+' : '−'}{money(t.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </article>
  );
}
