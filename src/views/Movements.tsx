'use client';

import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useStore, newId } from '../data/store';
import { TRANSACTION_CATEGORIES, type Transaction } from '../data/types';
import { Card, Empty, Field, NumberInput, Select, Stat } from '../components/ui';
import { EditDialog } from '../components/EditDialog';
import { useEditor } from '../components/useEditor';
import { monthKey, monthTotals, shiftMonth, suggestCategory } from '../lib/finance/transactions';
import { money, percent } from '../lib/format';

const today = () => {
  const d = new Date();
  return `${monthKey(d)}-${String(d.getDate()).padStart(2, '0')}`;
};

const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  const s = new Date(y, m - 1, 1).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const dayLabel = (iso: string) => {
  const s = new Date(`${iso}T00:00:00`).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const TYPE_LABELS = { expense: 'Despesa', income: 'Entrada' } as const;

export function Movements() {
  const { data, upsert } = useStore();
  const transactions = data.transactions ?? [];
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [filter, setFilter] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const editor = useEditor(
    'transactions',
    (): Transaction => ({ id: newId(), date: today(), description: '', amount: 0, type: 'expense', category: 'Outros', source: 'manual' }),
  );

  const current = useMemo(() => monthTotals(transactions, month), [transactions, month]);
  const previous = useMemo(() => monthTotals(transactions, shiftMonth(month, -1)), [transactions, month]);
  const isCurrentMonth = month === monthKey(new Date());
  const daysElapsed = isCurrentMonth ? new Date().getDate() : new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions
      .filter((t) => monthKey(t.date) === month)
      .filter((t) => !filter || t.category === filter)
      .filter((t) => !q || t.description.toLowerCase().includes(q) || t.note?.toLowerCase().includes(q))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }, [transactions, month, filter, query]);

  const byDay = useMemo(() => {
    const groups = new Map<string, Transaction[]>();
    for (const t of visible) groups.set(t.date, [...(groups.get(t.date) ?? []), t]);
    return [...groups];
  }, [visible]);

  const change = previous.spent > 0 ? current.spent / previous.spent - 1 : null;

  return (
    <>
      <h1>Movimentos</h1>
      <p className="muted lead">
        Regista aqui as despesas que não são fixas — jantares, compras, saídas, viagens. A média dos últimos 3 meses entra no
        Resumo, nos Cenários e no Plano 50/30/20.
      </p>

      <QuickAdd onAdd={(t) => {
        upsert('transactions', t);
        setMonth(monthKey(t.date));
      }} />

      <div className="month-nav">
        <button className="ghost" aria-label="Mês anterior" onClick={() => setMonth(shiftMonth(month, -1))}>
          ‹
        </button>
        <strong>{monthLabel(month)}</strong>
        <button className="ghost" aria-label="Mês seguinte" onClick={() => setMonth(shiftMonth(month, 1))} disabled={isCurrentMonth}>
          ›
        </button>
        {!isCurrentMonth && (
          <button className="link small" onClick={() => setMonth(monthKey(new Date()))}>
            Voltar a este mês
          </button>
        )}
      </div>

      <div className="stats">
        <Stat
          label="Gasto no mês"
          value={money(current.spent)}
          hint={change === null ? undefined : `${change >= 0 ? '+' : ''}${percent(change)} vs. ${monthLabel(shiftMonth(month, -1)).toLowerCase()}`}
          tone={change === null ? undefined : change > 0.1 ? 'bad' : change < -0.05 ? 'good' : undefined}
        />
        <Stat label="Média por dia" value={money(daysElapsed ? current.spent / daysElapsed : 0)} hint={`${daysElapsed} dias`} />
        <Stat label="Movimentos" value={String(current.count)} hint={current.received ? `Entradas: ${money(current.received)}` : undefined} />
        <Stat label="Maior despesa" value={current.largest ? money(current.largest.amount) : '—'} hint={current.largest?.description} />
      </div>

      <div className="grid-2 movements-grid">
        <Card title="Por categoria">
          {current.byCategory.length ? (
            <div className="breakdown">
              {current.byCategory.map(([cat, v]) => (
                <button
                  key={cat}
                  className={`bar-row bar-button ${filter === cat ? 'on' : ''}`}
                  onClick={() => setFilter(filter === cat ? null : cat)}
                  aria-pressed={filter === cat}
                >
                  <span>{cat}</span>
                  <div className="bar">
                    <div className="bar-fill" style={{ width: `${(v / current.spent) * 100}%` }} />
                  </div>
                  <span className="num">{money(v)}</span>
                </button>
              ))}
            </div>
          ) : (
            <Empty>Sem despesas neste mês.</Empty>
          )}
          {filter && (
            <p className="small">
              A mostrar só <strong>{filter}</strong>.{' '}
              <button className="link" onClick={() => setFilter(null)}>
                Mostrar tudo
              </button>
            </p>
          )}
        </Card>

        <Card
          title="Lista"
          actions={
            <input className="search" type="search" placeholder="Pesquisar…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Pesquisar movimentos" />
          }
        >
          {byDay.length ? (
            <div className="day-groups">
              {byDay.map(([day, items]) => (
                <section key={day}>
                  <header className="day-head">
                    <span>{dayLabel(day)}</span>
                    <span className="muted">{money(items.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0))}</span>
                  </header>
                  <ul className="list clickable">
                    {items.map((t) => (
                      <li key={t.id} onClick={() => editor.edit(t)}>
                        <span>
                          {t.description || t.category}
                          {t.source === 'import' && <span className="tag">importado</span>}
                        </span>
                        <span className="muted">{t.category}</span>
                        <strong className={t.type === 'income' ? 'good' : undefined}>
                          {t.type === 'income' ? '+' : '−'}
                          {money(t.amount)}
                        </strong>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <Empty>{query || filter ? 'Nenhum movimento corresponde ao filtro.' : 'Ainda sem movimentos neste mês.'}</Empty>
          )}
        </Card>
      </div>

      <Card title="Importar extrato bancário">
        <div className="coming-soon">
          <span className="tag">Em breve</span>
          <p className="muted">
            Vais poder carregar o extrato do banco (PDF, CSV ou Excel) e a IA identifica cada movimento, sugere a categoria e põe tudo no
            sítio certo — despesas pontuais aqui, e despesas fixas ou subscrições recorrentes nas respetivas páginas. Antes de gravar,
            revês e corriges a lista.
          </p>
        </div>
      </Card>

      <EditDialog
        title={editor.isNew ? 'Novo movimento' : 'Editar movimento'}
        open={editor.open}
        onClose={editor.close}
        onSave={editor.save}
        onDelete={editor.isNew ? undefined : editor.remove}
      >
        {editor.draft && (
          <>
            <Field label="Descrição">
              <input value={editor.draft.description} onChange={(e) => editor.set('description', e.target.value)} />
            </Field>
            <Field label="Valor (€)">
              <NumberInput value={editor.draft.amount} onChange={(n) => editor.set('amount', Math.abs(n))} min={0} />
            </Field>
            <Field label="Tipo">
              <Select value={editor.draft.type} options={TYPE_LABELS} onChange={(v) => editor.set('type', v as Transaction['type'])} />
            </Field>
            <Field label="Categoria">
              <Select value={editor.draft.category} options={TRANSACTION_CATEGORIES} onChange={(v) => editor.set('category', v)} />
            </Field>
            <Field label="Data">
              <input type="date" required value={editor.draft.date} onChange={(e) => editor.set('date', e.target.value)} />
            </Field>
            <Field label="Nota (opcional)">
              <input value={editor.draft.note ?? ''} onChange={(e) => editor.set('note', e.target.value || undefined)} />
            </Field>
          </>
        )}
      </EditDialog>
    </>
  );
}

/** One-line entry: type the amount and a description, the category is guessed, Enter saves. */
function QuickAdd({ onAdd }: { onAdd: (t: Transaction) => void }) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('Restauração');
  const [touchedCategory, setTouchedCategory] = useState(false);
  const [date, setDate] = useState(today);
  const [flash, setFlash] = useState<string | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  const onDescription = (value: string) => {
    setDescription(value);
    if (!touchedCategory) {
      const suggested = suggestCategory(value);
      if (suggested) setCategory(suggested);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = Math.abs(Number(amount.replace(',', '.')));
    if (!value) return;
    onAdd({ id: newId(), date, description: description.trim(), amount: value, type: 'expense', category, source: 'manual' });
    setFlash(`${money(value)} em ${category} adicionado.`);
    setAmount('');
    setDescription('');
    setTouchedCategory(false);
    // Back to today, so a back-dated entry doesn't silently date the next ones too.
    setDate(today());
    amountRef.current?.focus();
    setTimeout(() => setFlash(null), 2500);
  };

  return (
    <form className="card quick-add" onSubmit={submit} aria-label="Adicionar despesa">
      <Field label="Valor (€)">
        <input
          ref={amountRef}
          inputMode="decimal"
          required
          placeholder="0,00"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
          aria-label="Valor"
        />
      </Field>
      <Field label="Descrição">
        <input value={description} onChange={(e) => onDescription(e.target.value)} placeholder="ex.: Jantar com amigos" />
      </Field>
      <Field label="Categoria">
        <Select
          value={category}
          options={TRANSACTION_CATEGORIES}
          onChange={(v) => {
            setCategory(v);
            setTouchedCategory(true);
          }}
        />
      </Field>
      <Field label="Data">
        <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <button type="submit" className="primary">
        Adicionar
      </button>
      {flash && (
        <p className="quick-flash good small" role="status">
          ✓ {flash}
        </p>
      )}
    </form>
  );
}
