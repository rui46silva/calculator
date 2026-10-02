'use client';

import { useState } from 'react';
import { useStore } from '../data/store';
import { TRANSACTION_CATEGORIES } from '../data/types';
import { Card, Empty, Field, NumberInput } from '../components/ui';
import { EditDialog } from '../components/EditDialog';
import { budgetStatus, type BudgetLevel } from '../lib/finance/budgets';
import { money, percent } from '../lib/format';

export const LEVEL_LABEL: Record<BudgetLevel, string> = { ok: 'Dentro do limite', warn: 'Perto do limite', over: 'Ultrapassado' };
/** Projections from the first few days of a month are mostly noise. */
const MIN_DAYS_FOR_PROJECTION = 7;

export const LEVEL_ICON: Record<BudgetLevel, string> = { ok: '✓', warn: '!', over: '✕' };

/** Monthly limits per category with progress, a month-end projection and alerts at 80% and 100%. */
export function BudgetsCard({ month, isCurrentMonth }: { month: string; isCurrentMonth: boolean }) {
  const { data, update } = useStore();
  const [editing, setEditing] = useState<Record<string, number> | null>(null);
  const statuses = budgetStatus(data.transactions ?? [], data.categoryBudgets, month);

  return (
    <Card title="Orçamentos do mês" actions={<button className="ghost" onClick={() => setEditing({ ...(data.categoryBudgets ?? {}) })}>Definir limites</button>}>
      {statuses.length ? (
        <ul className="budgets">
          {statuses.map((b) => (
            <li key={b.category}>
              <div className="budget-head">
                <strong>{b.category}</strong>
                <span className={`status status-${b.level}`}>
                  <span aria-hidden>{LEVEL_ICON[b.level]}</span> {LEVEL_LABEL[b.level]}
                </span>
              </div>
              <div className="bar budget-bar" role="progressbar" aria-valuenow={Math.round(b.share * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={b.category}>
                <div className={`bar-fill level-${b.level}`} style={{ width: `${Math.min(100, b.share * 100)}%` }} />
              </div>
              <div className="budget-foot muted small">
                <span>
                  {money(b.spent)} de {money(b.limit)} ({percent(b.share)})
                </span>
                {isCurrentMonth && new Date().getDate() >= MIN_DAYS_FOR_PROJECTION && b.level !== 'over' && b.projected > b.limit && (
                  <span className="status-warn">Ao ritmo atual: {money(b.projected)} no fim do mês</span>
                )}
                {b.level !== 'over' && <span>Restam {money(b.limit - b.spent)}</span>}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>Define um limite mensal para restaurantes, compras ou lazer e recebe um aviso aos 80%.</Empty>
      )}

      <EditDialog
        title="Limites mensais por categoria"
        open={editing !== null}
        onClose={() => setEditing(null)}
        onSave={() => {
          const clean = Object.fromEntries(Object.entries(editing ?? {}).filter(([, v]) => v > 0));
          update({ categoryBudgets: clean });
          setEditing(null);
        }}
      >
        {editing &&
          TRANSACTION_CATEGORIES.map((c) => (
            <Field key={c} label={`${c} (€/mês)`}>
              <NumberInput value={editing[c] ?? 0} onChange={(n) => setEditing({ ...editing, [c]: Math.max(0, n) })} min={0} />
            </Field>
          ))}
      </EditDialog>
    </Card>
  );
}
