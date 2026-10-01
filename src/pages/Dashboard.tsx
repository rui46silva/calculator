import { Link } from 'react-router-dom';
import { useStore } from '../data/store';
import { Card, Stat } from '../components/ui';
import { effortRate } from '../lib/finance/loan';
import { money, percent, date } from '../lib/format';
import { monthlySummary } from '../lib/summary';

const EFFORT_LIMIT = 0.35;
const RENEWAL_WINDOW_DAYS = 30;

export function Dashboard() {
  const { data } = useStore();
  const s = monthlySummary(data);
  const effort = effortRate(s.debt, s.income);
  const outgoing = s.expenses + s.subscriptions + s.debt;

  const now = Date.now();
  const renewals = data.subscriptions
    .filter((sub) => {
      const t = new Date(sub.nextRenewal).getTime();
      return t >= now - 86_400_000 && t <= now + RENEWAL_WINDOW_DAYS * 86_400_000;
    })
    .sort((a, b) => a.nextRenewal.localeCompare(b.nextRenewal));

  const isEmpty = !data.incomes.length && !data.expenses.length && !data.loans.length && !data.subscriptions.length;

  return (
    <>
      <h1>Resumo</h1>
      {isEmpty && (
        <Card>
          <p>
            Começa por adicionar os teus <Link to="/orcamento">rendimentos e despesas</Link>,{' '}
            <Link to="/creditos">créditos</Link> e <Link to="/subscricoes">subscrições</Link>.
          </p>
        </Card>
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
        <Stat label="Dívida em aberto" value={money(s.debtBalance)} />
        <Stat label="Investimentos" value={money(s.portfolioValue)} />
        <Stat
          label="Património líquido"
          value={money(s.netWorth)}
          hint="Investimentos − dívidas (sem imóveis)"
          tone={s.netWorth >= 0 ? 'good' : 'bad'}
        />
      </div>

      <div className="grid-2">
        <Card title="Para onde vai o dinheiro (mensal)">
          <Breakdown
            items={[
              ['Despesas', s.expenses],
              ['Prestações', s.debt],
              ['Subscrições', s.subscriptions],
              ['Sobra', Math.max(s.balance, 0)],
            ]}
            total={Math.max(s.income, outgoing)}
          />
        </Card>
        <Card title={`Renovações nos próximos ${RENEWAL_WINDOW_DAYS} dias`}>
          {renewals.length ? (
            <ul className="list">
              {renewals.map((r) => (
                <li key={r.id}>
                  <span>{r.name}</span>
                  <span className="muted">{date(r.nextRenewal)}</span>
                  <strong>{money(r.amount)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Nenhuma renovação próxima.</p>
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
