'use client';

import { useStore, newId } from '../data/store';
import { Card } from '../components/ui';
import { detectRecurring, type RecurringSuggestion } from '../lib/finance/recurring';
import { money } from '../lib/format';

const FIXED_CATEGORY: Record<string, string> = {
  Restauração: 'Alimentação',
  Supermercado: 'Alimentação',
  Transportes: 'Transportes',
  Saúde: 'Saúde',
  Educação: 'Educação',
  Casa: 'Habitação',
  Lazer: 'Lazer',
};

/** Suggests turning repeated one-off movements into fixed expenses or subscriptions. */
export function RecurringCard() {
  const { data, upsert, update } = useStore();
  const suggestions = detectRecurring(data);
  if (!suggestions.length) return null;

  const dismiss = (s: RecurringSuggestion) => update({ dismissedRecurring: [...(data.dismissedRecurring ?? []), s.key] });

  const toSubscription = (s: RecurringSuggestion) => {
    const next = new Date(`${s.lastDate}T00:00:00`);
    next.setMonth(next.getMonth() + 1);
    upsert('subscriptions', {
      id: newId(),
      name: s.description,
      category: 'Outros',
      amount: s.averageAmount,
      frequency: 'monthly',
      nextRenewal: next.toISOString().slice(0, 10),
      rarelyUsed: false,
    });
  };

  const toExpense = (s: RecurringSuggestion) =>
    upsert('expenses', {
      id: newId(),
      name: s.description,
      category: FIXED_CATEGORY[s.category] ?? 'Outros',
      amount: s.averageAmount,
      frequency: 'monthly',
    });

  return (
    <Card title="Parecem despesas recorrentes">
      <p className="muted small">
        Estes movimentos repetem-se todos os meses com valores parecidos. Passá-los para despesa fixa ou subscrição torna o plano mensal
        mais certo. Os movimentos já registados ficam como estão.
      </p>
      <ul className="list recurring">
        {suggestions.map((s) => (
          <li key={s.key}>
            <span>
              <strong>{s.description}</strong>
              <span className="muted small">
                {' '}
                · {s.months} meses · {s.category}
              </span>
            </span>
            <strong>{money(s.averageAmount)}/mês</strong>
            <span className="recurring-actions">
              <button className={s.suggestion === 'subscription' ? 'primary' : 'ghost'} onClick={() => toSubscription(s)}>
                Subscrição
              </button>
              <button className={s.suggestion === 'expense' ? 'primary' : 'ghost'} onClick={() => toExpense(s)}>
                Despesa fixa
              </button>
              <button className="link" onClick={() => dismiss(s)}>
                Ignorar
              </button>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
