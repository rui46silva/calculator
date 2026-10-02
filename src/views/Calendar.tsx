'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useStore } from '../data/store';
import { Card, Empty, Stat } from '../components/ui';
import { upcomingPayments, type PaymentEvent } from '../lib/finance/calendar';
import { monthKey, shiftMonth } from '../lib/finance/transactions';
import { money } from '../lib/format';

const KIND_LABEL: Record<PaymentEvent['kind'], string> = { loan: 'Prestação', subscription: 'Subscrição', expense: 'Despesa fixa' };
const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  const s = new Date(y, m - 1, 1).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const isoDay = (d: Date) => `${monthKey(d)}-${String(d.getDate()).padStart(2, '0')}`;

export function CalendarView() {
  const { data } = useStore();
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [selected, setSelected] = useState<string | null>(null);
  const todayIso = isoDay(new Date());

  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const last = new Date(y, m, 0);
  const events = useMemo(() => upcomingPayments(data, first, last), [data, month]); // eslint-disable-line react-hooks/exhaustive-deps
  const next30 = useMemo(() => {
    const from = new Date();
    return upcomingPayments(data, from, new Date(from.getFullYear(), from.getMonth(), from.getDate() + 30));
  }, [data]);

  const byDay = new Map<string, PaymentEvent[]>();
  for (const e of events) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
  const lead = (first.getDay() + 6) % 7; // Monday-first grid
  const cells = [...Array.from({ length: lead }, () => null), ...Array.from({ length: last.getDate() }, (_, i) => i + 1)];
  const monthTotal = events.reduce((a, e) => a + e.amount, 0);
  const biggest = events.reduce<PaymentEvent | null>((max, e) => (!max || e.amount > max.amount ? e : max), null);
  const shown = selected ? byDay.get(selected) ?? [] : null;
  const hasSources = data.loans.length || data.subscriptions.some((s) => s.nextRenewal) || data.expenses.some((e) => e.dueDate);

  return (
    <>
      <h1>Calendário de pagamentos</h1>
      <p className="muted lead">
        Prestações, subscrições e despesas fixas com data. Para as despesas anuais (IMI, IUC, seguros) aparecerem, indica o próximo
        pagamento em <Link href="/orcamento">Despesas fixas</Link>.
      </p>

      <div className="stats">
        <Stat label={`Total em ${monthLabel(month).toLowerCase()}`} value={money(monthTotal)} hint={`${events.length} pagamentos`} />
        <Stat label="Próximos 30 dias" value={money(next30.reduce((a, e) => a + e.amount, 0))} hint={`${next30.length} pagamentos`} />
        <Stat label="Maior pagamento do mês" value={biggest ? money(biggest.amount) : '—'} hint={biggest?.title} />
      </div>

      <div className="grid-2 calendar-grid-wrap">
        <Card>
          <div className="month-nav">
            <button className="ghost" aria-label="Mês anterior" onClick={() => setMonth(shiftMonth(month, -1))}>
              ‹
            </button>
            <strong>{monthLabel(month)}</strong>
            <button className="ghost" aria-label="Mês seguinte" onClick={() => setMonth(shiftMonth(month, 1))}>
              ›
            </button>
          </div>
          <div className="cal" role="grid" aria-label={`Pagamentos em ${monthLabel(month)}`}>
            {WEEKDAYS.map((d) => (
              <div key={d} className="cal-head" role="columnheader">
                {d}
              </div>
            ))}
            {cells.map((day, i) => {
              if (!day) return <div key={`e${i}`} />;
              const iso = `${month}-${String(day).padStart(2, '0')}`;
              const list = byDay.get(iso) ?? [];
              const total = list.reduce((a, e) => a + e.amount, 0);
              return (
                <button
                  key={iso}
                  role="gridcell"
                  className={`cal-day ${iso === todayIso ? 'today' : ''} ${selected === iso ? 'selected' : ''} ${list.length ? 'has' : ''}`}
                  onClick={() => setSelected(selected === iso ? null : iso)}
                  aria-label={`${day}: ${list.length ? `${list.length} pagamentos, ${money(total)}` : 'sem pagamentos'}`}
                >
                  <span className="cal-num">{day}</span>
                  {list.length > 0 && <span className="cal-amount">{money(total)}</span>}
                  {list.length > 0 && <span className="cal-dot" aria-hidden />}
                </button>
              );
            })}
          </div>
        </Card>

        <Card title={shown ? `Dia ${Number(selected!.slice(8))}` : 'Próximos 30 dias'}>
          {!hasSources ? (
            <Empty>Ainda não há pagamentos com data. Adiciona créditos, subscrições ou datas às despesas fixas.</Empty>
          ) : (shown ?? next30).length ? (
            <ul className="list">
              {(shown ?? next30).map((e, i) => (
                <li key={`${e.sourceId}-${e.date}-${i}`}>
                  <span>
                    {e.title}
                    <span className="muted small"> · {KIND_LABEL[e.kind]}</span>
                  </span>
                  <span className="muted">{new Date(`${e.date}T00:00:00`).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}</span>
                  <strong>{money(e.amount)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>{shown ? 'Sem pagamentos neste dia.' : 'Sem pagamentos nos próximos 30 dias.'}</Empty>
          )}
          {shown && (
            <button className="link small" onClick={() => setSelected(null)}>
              Ver próximos 30 dias
            </button>
          )}
        </Card>
      </div>
    </>
  );
}
