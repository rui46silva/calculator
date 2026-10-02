'use client';

import Link from 'next/link';
import { useStore, newId } from '../data/store';
import { ASSET_TYPES, type Asset } from '../data/types';
import { Card, Empty, Field, NumberInput, Select, Stat } from '../components/ui';
import { EditDialog } from '../components/EditDialog';
import { useEditor } from '../components/useEditor';
import { TimeChart } from '../components/TimeChart';
import { loanStatus, monthlySummary } from '../lib/summary';
import { money, percent } from '../lib/format';

const compact = new Intl.NumberFormat('pt-PT', { notation: 'compact', maximumFractionDigits: 1 });
const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' });
};
const monthIndex = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return y * 12 + (m - 1);
};
const fromIndex = (i: number) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;

export function NetWorth() {
  const { data } = useStore();
  const s = monthlySummary(data);
  const editor = useEditor('assets', (): Asset => ({ id: newId(), name: '', type: ASSET_TYPES[0], value: 0 }));
  const assets = data.assets ?? [];
  const snapshots = data.snapshots ?? [];
  const debts = data.loans.map((l) => ({ loan: l, status: loanStatus(l) })).filter((d) => d.status.balance > 0.005);

  const byType = new Map<string, number>();
  for (const a of assets) byType.set(a.type, (byType.get(a.type) ?? 0) + a.value);
  if (s.portfolioValue > 0) byType.set('Investimentos', s.portfolioValue);
  const gross = s.assets + s.portfolioValue;

  return (
    <>
      <h1>Património</h1>
      <p className="muted lead">Tudo o que tens (casa, carro, contas, investimentos) menos tudo o que deves.</p>

      <div className="stats">
        <Stat label="Património líquido" value={money(s.netWorth)} tone={s.netWorth >= 0 ? 'good' : 'bad'} />
        <Stat label="Bens" value={money(s.assets)} hint={`${assets.length} registados`} />
        <Stat label="Investimentos" value={money(s.portfolioValue)} />
        <Stat label="Dívidas" value={money(s.debtBalance)} hint={gross > 0 ? `${percent(s.debtBalance / gross)} do que tens` : undefined} />
      </div>

      <Card title="Evolução mês a mês">
        {snapshots.length >= 2 ? (
          (() => {
            // Fill gaps so the x axis is continuous.
            const first = monthIndex(snapshots[0].month);
            const last = monthIndex(snapshots[snapshots.length - 1].month);
            const byMonth = new Map(snapshots.map((x) => [x.month, x]));
            const months = Array.from({ length: last - first + 1 }, (_, i) => fromIndex(first + i));
            let prev = snapshots[0];
            const rows = months.map((m) => (prev = byMonth.get(m) ?? prev));
            return (
              <TimeChart
                ariaLabel="Evolução do património líquido, investimentos e dívidas"
                x={months.map(monthIndex)}
                series={[
                  { kind: 'line', key: 'net', label: 'Património líquido', color: 'var(--series-1)', values: rows.map((r) => r.netWorth) },
                  { kind: 'line', key: 'inv', label: 'Investimentos', color: 'var(--series-3)', values: rows.map((r) => r.investments) },
                  { kind: 'line', key: 'debt', label: 'Dívidas', color: 'var(--series-2)', values: rows.map((r) => r.debt), dashed: true },
                ]}
                formatX={(i) => monthLabel(fromIndex(i))}
                formatY={money}
                formatTick={(v) => compact.format(v)}
              />
            );
          })()
        ) : (
          <Empty>
            A app guarda automaticamente um resumo de cada mês. O gráfico aparece a partir do segundo mês de utilização
            {snapshots.length === 1 ? ` (primeiro registo: ${monthLabel(snapshots[0].month)})` : ''}.
          </Empty>
        )}
        {snapshots.length > 0 && (
          <details className="table-details">
            <summary>Ver histórico</summary>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Mês</th>
                    <th className="num">Rendimento</th>
                    <th className="num">Saídas</th>
                    <th className="num">Poupança</th>
                    <th className="num">Património</th>
                  </tr>
                </thead>
                <tbody>
                  {[...snapshots].reverse().map((r) => (
                    <tr key={r.month}>
                      <td>{monthLabel(r.month)}</td>
                      <td className="num">{money(r.income)}</td>
                      <td className="num">{money(r.outgoing)}</td>
                      <td className={`num ${r.savings < 0 ? 'bad' : ''}`}>{money(r.savings)}</td>
                      <td className="num">{money(r.netWorth)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </Card>

      <div className="grid-2">
        <Card title="Bens" actions={<button onClick={editor.add}>+ Adicionar</button>}>
          {assets.length ? (
            <ul className="list clickable">
              {assets.map((a) => (
                <li key={a.id} onClick={() => editor.edit(a)}>
                  <span>{a.name}</span>
                  <span className="muted">{a.type}</span>
                  <strong>{money(a.value)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Adiciona a casa, o carro e as contas bancárias (incluindo o fundo de emergência) com o valor atual.</Empty>
          )}
        </Card>

        <Card title="Composição">
          {gross > 0 ? (
            <div className="breakdown">
              {[...byType].sort((a, b) => b[1] - a[1]).map(([type, v]) => (
                <div key={type} className="bar-row">
                  <span>{type}</span>
                  <div className="bar">
                    <div className="bar-fill" style={{ width: `${(v / gross) * 100}%` }} />
                  </div>
                  <span className="num">{percent(v / gross)}</span>
                </div>
              ))}
            </div>
          ) : (
            <Empty>Sem bens nem investimentos registados.</Empty>
          )}
          {debts.length > 0 && (
            <>
              <h3 className="section-title">Dívidas</h3>
              <ul className="list">
                {debts.map(({ loan, status }) => (
                  <li key={loan.id}>
                    <span>{loan.name}</span>
                    <span className="muted">{status.remainingMonths} meses</span>
                    <strong className="bad">−{money(status.balance)}</strong>
                  </li>
                ))}
              </ul>
              <p className="muted small">
                Geridas em <Link href="/creditos">Créditos</Link>.
              </p>
            </>
          )}
        </Card>
      </div>

      <EditDialog
        title={editor.isNew ? 'Novo bem' : 'Editar bem'}
        open={editor.open}
        onClose={editor.close}
        onSave={editor.save}
        onDelete={editor.isNew ? undefined : editor.remove}
      >
        {editor.draft && (
          <>
            <Field label="Nome">
              <input required value={editor.draft.name} onChange={(e) => editor.set('name', e.target.value)} placeholder="ex.: Apartamento Lisboa" />
            </Field>
            <Field label="Tipo">
              <Select value={editor.draft.type} options={ASSET_TYPES} onChange={(v) => editor.set('type', v)} />
            </Field>
            <Field label="Valor atual (€)">
              <NumberInput value={editor.draft.value} onChange={(n) => editor.set('value', Math.max(0, n))} min={0} />
            </Field>
          </>
        )}
      </EditDialog>
    </>
  );
}
