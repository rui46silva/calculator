'use client';

import { useState } from 'react';
import { newId } from '../data/store';
import type { Lot } from '../data/types';
import { NumberInput } from '../components/ui';
import { summarizeLots } from '../lib/finance/portfolio';
import { date, money } from '../lib/format';

const todayIso = () => new Date().toISOString().slice(0, 10);

/** Purchase log inside the investment dialog. Units and amount invested follow from it. */
export function LotsEditor({ lots, onChange }: { lots: Lot[]; onChange: (lots: Lot[]) => void }) {
  const [draft, setDraft] = useState<Lot>(() => ({ id: newId(), date: todayIso(), units: 0, price: 0, fees: 0 }));
  const summary = summarizeLots(lots);
  const sorted = [...lots].sort((a, b) => b.date.localeCompare(a.date));

  const add = () => {
    if (draft.units <= 0 || draft.price <= 0) return;
    onChange([...lots, draft]);
    setDraft({ id: newId(), date: draft.date, units: 0, price: 0, fees: 0 });
  };

  return (
    <div className="lots full">
      <h3>Compras</h3>
      {sorted.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th className="num">Unid.</th>
                <th className="num">Preço</th>
                <th className="num">Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sorted.map((l) => (
                <tr key={l.id}>
                  <td>{date(l.date)}</td>
                  <td className="num">{l.units}</td>
                  <td className="num">{money(l.price)}</td>
                  <td className="num">{money(l.units * l.price + (l.fees || 0))}</td>
                  <td>
                    <button type="button" className="link" aria-label="Remover compra" onClick={() => onChange(lots.filter((x) => x.id !== l.id))}>
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="lot-form">
        <label className="field">
          <span>Data</span>
          <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
        </label>
        <label className="field">
          <span>Unidades</span>
          <NumberInput value={draft.units} onChange={(n) => setDraft({ ...draft, units: Math.max(0, n) })} min={0} />
        </label>
        <label className="field">
          <span>Preço/unid. (€)</span>
          <NumberInput value={draft.price} onChange={(n) => setDraft({ ...draft, price: Math.max(0, n) })} min={0} />
        </label>
        <label className="field">
          <span>Comissão (€)</span>
          <NumberInput value={draft.fees} onChange={(n) => setDraft({ ...draft, fees: Math.max(0, n) })} min={0} />
        </label>
        <button type="button" className="ghost" onClick={add} disabled={draft.units <= 0 || draft.price <= 0}>
          + Registar compra
        </button>
      </div>
      {lots.length > 0 && (
        <p className="muted small">
          {summary.units} unidades · investido {money(summary.invested)} · preço médio {money(summary.averagePrice)}
        </p>
      )}
    </div>
  );
}
