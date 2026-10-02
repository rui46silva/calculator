'use client';

import { useStore, newId, type Household } from '../data/store';
import { Card } from '../components/ui';
import { settleUp, splitBalances } from '../lib/finance/split';
import { date, money } from '../lib/format';

export function memberName(household: Household | null, userId: string | undefined): string {
  const m = household?.members.find((x) => x.userId === userId);
  return m ? m.name || m.email.split('@')[0] : '—';
}

/** "Contas da casa": who paid what for shared expenses and who owes whom. */
export function SplitCard() {
  const { data, user, household, update } = useStore();
  if (!household || household.members.length < 2) return null;

  const members = household.members.map((m) => m.userId);
  const owner = household.members.find((m) => m.role === 'owner')?.userId ?? user.id;
  const settlements = data.settlements ?? [];
  const balances = splitBalances(data.transactions ?? [], settlements, members, owner);
  const transfers = settleUp(balances);
  const name = (id: string) => (id === user.id ? 'Tu' : memberName(household, id));

  const settle = (from: string, to: string, amount: number) =>
    update({ settlements: [...settlements, { id: newId(), date: new Date().toISOString().slice(0, 10), from, to, amount }] });

  return (
    <Card title="Contas da casa">
      <p className="muted small">Despesas partilhadas divididas em partes iguais. Marca uma despesa como pessoal no movimento para não entrar na divisão.</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Pessoa</th>
              <th className="num">Pagou</th>
              <th className="num">Parte</th>
              <th className="num">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {balances.map((b) => (
              <tr key={b.userId}>
                <td>{name(b.userId)}</td>
                <td className="num">{money(b.paid)}</td>
                <td className="num">{money(b.share)}</td>
                <td className={`num ${b.balance > 0.005 ? 'good' : b.balance < -0.005 ? 'bad' : ''}`}>{money(b.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {transfers.length ? (
        <ul className="list settle">
          {transfers.map((t) => (
            <li key={`${t.from}-${t.to}`}>
              <span>
                <strong>{name(t.from)}</strong> {t.from === user.id ? 'deves' : 'deve'} <strong>{money(t.amount)}</strong> a {name(t.to)}
              </span>
              <button className="ghost small-btn" onClick={() => settle(t.from, t.to, t.amount)}>
                Registar acerto
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="good small">✓ Contas acertadas.</p>
      )}
      {settlements.length > 0 && (
        <details className="table-details">
          <summary>Acertos registados ({settlements.length})</summary>
          <ul className="list">
            {[...settlements].reverse().slice(0, 10).map((s) => (
              <li key={s.id}>
                <span>
                  {name(s.from)} → {name(s.to)}
                </span>
                <span className="muted">{date(s.date)}</span>
                <strong>{money(s.amount)}</strong>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}
