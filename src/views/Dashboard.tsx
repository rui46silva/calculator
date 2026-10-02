'use client';

import Link from 'next/link';
import { useStore } from '../data/store';
import { Card, Stat } from '../components/ui';
import { effortRate } from '../lib/finance/loan';
import { money, percent, date } from '../lib/format';
import { monthlySummary } from '../lib/summary';
import { monthKey, monthTotals } from '../lib/finance/transactions';
import { upcomingPayments } from '../lib/finance/calendar';
import { budgetStatus } from '../lib/finance/budgets';

const EFFORT_LIMIT = 0.35;
const UPCOMING_DAYS = 14;
const ALERT_DAYS = 3;

export function Dashboard() {
  const { data } = useStore();
  const s = monthlySummary(data);
  const effort = effortRate(s.debt, s.income);
  const outgoing = s.expenses + s.subscriptions + s.oneOff + s.debt;
  const thisMonth = monthTotals(data.transactions ?? [], monthKey(new Date()));

  const today = new Date();
  const upcoming = upcomingPayments(data, today, new Date(today.getFullYear(), today.getMonth(), today.getDate() + UPCOMING_DAYS));
  const soon = upcoming.filter((e) => new Date(`${e.date}T00:00:00`).getTime() - today.getTime() <= ALERT_DAYS * 86_400_000);
  const budgetAlerts = budgetStatus(data.transactions ?? [], data.categoryBudgets, monthKey(today), today).filter((b) => b.level !== 'ok');

  const isEmpty = !data.incomes.length && !data.expenses.length && !data.loans.length && !data.subscriptions.length;

  return (
    <>
      <h1>Resumo</h1>
      {isEmpty && (
        <Card>
          <p>
            Começa por adicionar os teus <Link href="/orcamento">rendimentos e despesas</Link>,{' '}
            <Link href="/creditos">créditos</Link> e <Link href="/subscricoes">subscrições</Link>.
          </p>
        </Card>
      )}
      {(budgetAlerts.length > 0 || soon.length > 0) && (
        <ul className="advice alerts">
          {budgetAlerts.map((b) => (
            <li key={b.category} className={b.level === 'over' ? 'advice-bad' : 'advice-warn'}>
              <span aria-hidden>{b.level === 'over' ? '✕' : '!'}</span>
              <span>
                {b.category}: {money(b.spent)} de {money(b.limit)} este mês ({b.level === 'over' ? 'limite ultrapassado' : 'perto do limite'}).{' '}
                <Link href="/movimentos">Ver movimentos</Link>
              </span>
            </li>
          ))}
          {soon.map((e, i) => (
            <li key={`${e.sourceId}-${i}`} className="advice-info">
              <span aria-hidden>i</span>
              <span>
                {e.title}: {money(e.amount)} a {date(e.date)}.
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="stats">
        <Stat label="Rendimento mensal" value={money(s.income)} />
        <Stat label="Saídas mensais" value={money(outgoing)} />
        <Stat label="Saldo mensal" value={money(s.balance)} tone={s.balance >= 0 ? 'good' : 'bad'} />
        <Stat
          label="Taxa de esforço"
          value={percent(effort)}
          hint={effort > EFFORT_LIMIT ? 'Acima de 35%: risco elevado' : 'Prestações / rendimento'}
          tone={effort > EFFORT_LIMIT ? 'bad' : undefined}
        />
        <Stat label="Gastos pontuais este mês" value={money(thisMonth.spent)} hint={`Média de 3 meses: ${money(s.oneOff)}/mês`} />
        <Stat label="Dívida em aberto" value={money(s.debtBalance)} />
        <Stat label="Investimentos" value={money(s.portfolioValue)} />
        <Stat
          label="Património líquido"
          value={money(s.netWorth)}
          hint="Bens + investimentos − dívidas"
          tone={s.netWorth >= 0 ? 'good' : 'bad'}
        />
      </div>

      <div className="grid-2">
        <Card title="Para onde vai o dinheiro (mensal)">
          <Breakdown
            items={[
              ['Despesas fixas', s.expenses],
              ['Pontuais', s.oneOff],
              ['Prestações', s.debt],
              ['Subscrições', s.subscriptions],
              ['Sobra', Math.max(s.balance, 0)],
            ]}
            total={Math.max(s.income, outgoing)}
          />
        </Card>
        <Card title={`Próximos pagamentos (${UPCOMING_DAYS} dias)`} actions={<Link href="/calendario" className="small">Calendário</Link>}>
          {upcoming.length ? (
            <ul className="list">
              {upcoming.slice(0, 8).map((e, i) => (
                <li key={`${e.sourceId}-${e.date}-${i}`}>
                  <span>{e.title}</span>
                  <span className="muted">{date(e.date)}</span>
                  <strong>{money(e.amount)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Nenhum pagamento previsto.</p>
          )}
        </Card>
      </div>
    </>
  );
}

function Breakdown({ items, total }: { items: [string, number][]; total: number }) {
  return (
    <div className="breakdown">
      {items.map(([label, value]) => (
        <div key={label} className="bar-row">
          <span>{label}</span>
          <div className="bar">
            <div className="bar-fill" style={{ width: `${total > 0 ? (value / total) * 100 : 0}%` }} />
          </div>
          <span className="num">{money(value)}</span>
        </div>
      ))}
    </div>
  );
}
