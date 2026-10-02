'use client';

import { useStore, newId } from '../data/store';
import { SUBSCRIPTION_CATEGORIES, type Subscription } from '../data/types';
import { Card, Empty, Field, NumberInput, Select, Stat } from '../components/ui';
import { EditDialog } from '../components/EditDialog';
import { useEditor } from '../components/useEditor';
import { FREQUENCY_LABELS, toAnnual, toMonthly, type Frequency } from '../lib/finance/frequency';
import { date, money } from '../lib/format';


export function Subscriptions() {
  const { data } = useStore();
  const editor = useEditor(
    'subscriptions',
    (): Subscription => ({
      id: newId(),
      name: '',
      category: SUBSCRIPTION_CATEGORIES[0],
      amount: 0,
      frequency: 'monthly',
      nextRenewal: new Date().toISOString().slice(0, 10),
      rarelyUsed: false,
    }),
  );

  const subs = [...data.subscriptions].sort((a, b) => toMonthly(b.amount, b.frequency) - toMonthly(a.amount, a.frequency));
  const monthly = subs.reduce((a, s) => a + toMonthly(s.amount, s.frequency), 0);
  const rarely = subs.filter((s) => s.rarelyUsed);
  const rarelyAnnual = rarely.reduce((a, s) => a + toAnnual(s.amount, s.frequency), 0);

  return (
    <>
      <h1>Subscrições</h1>
      <div className="stats">
        <Stat label="Custo mensal" value={money(monthly)} />
        <Stat label="Custo anual" value={money(monthly * 12)} />
        <Stat label="Subscrições ativas" value={String(subs.length)} />
        <Stat
          label="Poupança se cancelares as pouco usadas"
          value={`${money(rarelyAnnual)}/ano`}
          hint={`${rarely.length} marcada(s) como pouco usada(s)`}
          tone={rarelyAnnual > 0 ? 'good' : undefined}
        />
      </div>

      <Card title="As minhas subscrições" actions={<button onClick={editor.add}>+ Adicionar</button>}>
        {subs.length ? (
          <ul className="list clickable">
            {subs.map((s) => (
              <li key={s.id} onClick={() => editor.edit(s)}>
                <span>
                  {s.name} {s.rarelyUsed && <span className="tag">pouco usada</span>}
                </span>
                <span className="muted">
                  {s.category} · renova {date(s.nextRenewal)}
                </span>
                <strong>
                  {money(s.amount)}
                  <span className="muted small"> / {FREQUENCY_LABELS[s.frequency].toLowerCase()}</span>
                </strong>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Adiciona Netflix, Spotify, ginásio, iCloud…</Empty>
        )}
      </Card>

      <EditDialog
        title={editor.isNew ? 'Nova subscrição' : 'Editar subscrição'}
        open={editor.open}
        onClose={editor.close}
        onSave={editor.save}
        onDelete={editor.isNew ? undefined : editor.remove}
      >
        {editor.draft && (
          <>
            <Field label="Nome">
              <input required value={editor.draft.name} onChange={(e) => editor.set('name', e.target.value)} />
            </Field>
            <Field label="Categoria">
              <Select value={editor.draft.category} options={SUBSCRIPTION_CATEGORIES} onChange={(v) => editor.set('category', v)} />
            </Field>
            <Field label="Valor (€)">
              <NumberInput value={editor.draft.amount} onChange={(n) => editor.set('amount', n)} min={0} />
            </Field>
            <Field label="Frequência">
              <Select value={editor.draft.frequency} options={FREQUENCY_LABELS} onChange={(v) => editor.set('frequency', v as Frequency)} />
            </Field>
            <Field label="Próxima renovação">
              <input type="date" value={editor.draft.nextRenewal} onChange={(e) => editor.set('nextRenewal', e.target.value)} />
            </Field>
            <label className="check">
              <input type="checkbox" checked={editor.draft.rarelyUsed} onChange={(e) => editor.set('rarelyUsed', e.target.checked)} />
              Uso pouco esta subscrição
            </label>
          </>
        )}
      </EditDialog>
    </>
  );
}
