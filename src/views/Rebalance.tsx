'use client';

import { useState } from 'react';
import { useStore } from '../data/store';
import { ASSET_CLASSES } from '../data/types';
import { Card, Empty, Field, NumberInput } from '../components/ui';
import { EditDialog } from '../components/EditDialog';
import { rebalance } from '../lib/finance/portfolio';
import { money, percent } from '../lib/format';

const DRIFT_ALERT = 0.05;

/** Target allocation per asset class and where to put next month's contribution to approach it. */
export function Rebalance({ contribution }: { contribution: number }) {
  const { data, update } = useStore();
  const targets = data.targetAllocation ?? {};
  const [editing, setEditing] = useState<Record<string, number> | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const monthly = amount ?? contribution;

  const values: Record<string, number> = {};
  for (const i of data.investments) values[i.assetClass] = (values[i.assetClass] ?? 0) + i.currentValue;
  const hasTargets = Object.values(targets).some((v) => v > 0);
  const rows = hasTargets ? rebalance(values, targets, monthly) : [];
  const drifted = rows.filter((r) => Math.abs(r.currentShare - r.target) >= DRIFT_ALERT);
  const editingTotal = editing ? Object.values(editing).reduce((a, b) => a + b, 0) : 0;

  return (
    <Card
      title="Rebalanceamento"
      actions={
        <button className="ghost" onClick={() => setEditing(Object.fromEntries(ASSET_CLASSES.map((c) => [c, Math.round((targets[c] ?? 0) * 100)])))}>
          Definir alocação-alvo
        </button>
      }
    >
      {!hasTargets ? (
        <Empty>Define a percentagem que queres em cada tipo (ex.: 80% ETF, 20% PPR) e a app diz onde investir cada mês para manter o equilíbrio sem vender nada.</Empty>
      ) : (
        <>
          <div className="form-grid">
            <Field label="Investimento deste mês (€)">
              <NumberInput value={monthly} onChange={(n) => setAmount(Math.max(0, n))} min={0} />
            </Field>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th className="num">Atual</th>
                  <th className="num">Alvo</th>
                  <th className="num">Investir este mês</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.assetClass}>
                    <td>{r.assetClass}</td>
                    <td className="num">
                      {percent(r.currentShare)} <span className="muted small">({money(r.current)})</span>
                    </td>
                    <td className="num">{percent(r.target)}</td>
                    <td className="num">
                      <strong>{money(r.buy)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={`small ${drifted.length ? 'status-warn' : 'muted'}`}>
            {drifted.length
              ? `${drifted.map((r) => r.assetClass).join(', ')} ${drifted.length > 1 ? 'estão' : 'está'} mais de 5 pontos fora do alvo — o investimento deste mês já compensa.`
              : 'A carteira está dentro de 5 pontos do alvo em todos os tipos.'}
          </p>
        </>
      )}

      <EditDialog
        title="Alocação-alvo (%)"
        open={editing !== null}
        onClose={() => setEditing(null)}
        onSave={() => {
          const sum = editingTotal || 1;
          update({ targetAllocation: Object.fromEntries(Object.entries(editing ?? {}).filter(([, v]) => v > 0).map(([k, v]) => [k, v / sum])) });
          setEditing(null);
        }}
      >
        {editing && (
          <>
            {ASSET_CLASSES.map((c) => (
              <Field key={c} label={`${c} (%)`}>
                <NumberInput value={editing[c] ?? 0} onChange={(n) => setEditing({ ...editing, [c]: Math.max(0, n) })} min={0} />
              </Field>
            ))}
            <p className={`full small ${Math.round(editingTotal) === 100 ? 'good' : 'status-warn'}`}>
              Total: {Math.round(editingTotal)}%{Math.round(editingTotal) === 100 ? '' : ' — será ajustado proporcionalmente para 100%'}
            </p>
          </>
        )}
      </EditDialog>
    </Card>
  );
}
