'use client';

import { useStore, newId } from '../data/store';
import { EXPENSE_CATEGORIES, type Expense, type Income } from '../data/types';
import { Card, Empty, Field, NumberInput, Select } from '../components/ui';
import { EditDialog } from '../components/EditDialog';
import { useEditor } from '../components/useEditor';
import { FREQUENCY_LABELS, toMonthly, type Frequency } from '../lib/finance/frequency';
import { money } from '../lib/format';

export function Budget() {
  const { data } = useStore();
  const incomes = useEditor('incomes', (): Income => ({ id: newId(), name: '', amount: 0, frequency: 'monthly' }));
  const expenses = useEditor(
    'expenses',
    (): Expense => ({ id: newId(), name: '', category: EXPENSE_CATEGORIES[0], amount: 0, frequency: 'monthly' }),
  );

  const byCategory = new Map<string, number>();
  for (const e of data.expenses) {
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + toMonthly(e.amount, e.frequency));
  }

  return (
    <>
      <h1>Despesas fixas</h1>
      <div className="grid-2">
        <Card title="Rendimentos" actions={<button onClick={incomes.add}>+ Adicionar</button>}>
          {data.incomes.length ? (
            <ul className="list clickable">
              {data.incomes.map((i) => (
                <li key={i.id} onClick={() => incomes.edit(i)}>
                  <span>{i.name}</span>
                  <span className="muted">{FREQUENCY_LABELS[i.frequency]}</span>
                  <strong>{money(i.amount)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Sem rendimentos registados.</Empty>
          )}
        </Card>

        <Card title="Despesas por categoria (mensal)">
          {byCategory.size ? (
            <ul className="list">
              {[...byCategory].sort((a, b) => b[1] - a[1]).map(([cat, v]) => (
                <li key={cat}>
                  <span>{cat}</span>
                  <strong>{money(v)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Sem despesas registadas.</Empty>
          )}
        </Card>
      </div>

      <Card title="Despesas" actions={<button onClick={expenses.add}>+ Adicionar</button>}>
        {data.expenses.length ? (
          <ul className="list clickable">
            {data.expenses.map((e) => (
              <li key={e.id} onClick={() => expenses.edit(e)}>
                <span>{e.name}</span>
                <span className="muted">
                  {e.category} · {FREQUENCY_LABELS[e.frequency]}
                </span>
                <strong>{money(e.amount)}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Adiciona despesas fixas (renda, luz, seguros) e anuais (IMI, IUC).</Empty>
        )}
      </Card>

      <EditDialog
        title={incomes.isNew ? 'Novo rendimento' : 'Editar rendimento'}
        open={incomes.open}
        onClose={incomes.close}
        onSave={incomes.save}
        onDelete={incomes.isNew ? undefined : incomes.remove}
      >
        {incomes.draft && (
          <>
            <Field label="Nome">
              <input required value={incomes.draft.name} onChange={(e) => incomes.set('name', e.target.value)} />
            </Field>
            <Field label="Valor (€)">
              <NumberInput value={incomes.draft.amount} onChange={(n) => incomes.set('amount', n)} min={0} />
            </Field>
            <Field label="Frequência">
              <Select value={incomes.draft.frequency} options={FREQUENCY_LABELS} onChange={(v) => incomes.set('frequency', v as Frequency)} />
            </Field>
          </>
        )}
      </EditDialog>

      <EditDialog
        title={expenses.isNew ? 'Nova despesa' : 'Editar despesa'}
        open={expenses.open}
        onClose={expenses.close}
        onSave={expenses.save}
        onDelete={expenses.isNew ? undefined : expenses.remove}
      >
        {expenses.draft && (
          <>
            <Field label="Nome">
              <input required value={expenses.draft.name} onChange={(e) => expenses.set('name', e.target.value)} />
            </Field>
            <Field label="Categoria">
              <Select value={expenses.draft.category} options={EXPENSE_CATEGORIES} onChange={(v) => expenses.set('category', v)} />
            </Field>
            <Field label="Valor (€)">
              <NumberInput value={expenses.draft.amount} onChange={(n) => expenses.set('amount', n)} min={0} />
            </Field>
            <Field label="Frequência">
              <Select value={expenses.draft.frequency} options={FREQUENCY_LABELS} onChange={(v) => expenses.set('frequency', v as Frequency)} />
            </Field>
            <Field label="Próximo pagamento (opcional)">
              <input type="date" value={expenses.draft.dueDate ?? ''} onChange={(e) => expenses.set('dueDate', e.target.value || undefined)} />
            </Field>
            <p className="muted small full">Com data, a despesa aparece no Calendário e nos lembretes.</p>
          </>
        )}
      </EditDialog>
    </>
  );
}
