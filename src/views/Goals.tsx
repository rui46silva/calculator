'use client';

import { useState } from 'react';
import { useStore, newId } from '../data/store';
import type { Goal } from '../data/types';
import { Card, Empty, Field, NumberInput, Stat } from '../components/ui';
import { EditDialog } from '../components/EditDialog';
import { useEditor } from '../components/useEditor';
import { goalPlan } from '../lib/finance/goals';
import { rulePlan } from '../lib/finance/budgetRule';
import { date, money, percent } from '../lib/format';

const ICONS = ['🎯', '✈️', '🏠', '🚗', '💍', '🎓', '🏖️', '💻', '👶', '🛟'];

const inAYear = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
};

export function Goals() {
  const { data, upsert } = useStore();
  const goals = data.goals ?? [];
  const editor = useEditor('goals', (): Goal => ({ id: newId(), name: '', icon: ICONS[0], target: 0, saved: 0, targetDate: inAYear() }));
  const [contribution, setContribution] = useState<{ goal: Goal; amount: number } | null>(null);

  const plans = goals.map((g) => ({ goal: g, plan: goalPlan(g) }));
  const active = plans.filter((p) => p.plan.status !== 'done');
  const monthlyNeeded = active.reduce((a, p) => a + p.plan.monthly, 0);
  const savingsBudget = rulePlan(data).savingsBudget;

  return (
    <>
      <h1>Metas de poupança</h1>
      <p className="muted lead">Define objetivos com valor e data — a app diz quanto precisas de pôr de lado por mês para lá chegar.</p>

      <div className="stats">
        <Stat label="Metas ativas" value={String(active.length)} hint={`${plans.length - active.length} concluídas`} />
        <Stat label="Precisas de poupar por mês" value={money(monthlyNeeded)} />
        <Stat
          label="Poupança disponível (Plano 50/30/20)"
          value={money(savingsBudget)}
          hint={monthlyNeeded > savingsBudget ? `Faltam ${money(monthlyNeeded - savingsBudget)}/mês — adia uma meta ou aumenta a poupança` : 'Chega para todas as metas'}
          tone={monthlyNeeded > savingsBudget ? 'bad' : 'good'}
        />
        <Stat label="Já poupado" value={money(goals.reduce((a, g) => a + g.saved, 0))} hint={`de ${money(goals.reduce((a, g) => a + g.target, 0))}`} />
      </div>

      <Card title="As tuas metas" actions={<button onClick={editor.add}>+ Nova meta</button>}>
        {plans.length ? (
          <div className="goals">
            {plans.map(({ goal, plan }) => (
              <article key={goal.id} className={`goal goal-${plan.status}`}>
                <header>
                  <span className="goal-icon" aria-hidden>
                    {goal.icon}
                  </span>
                  <div>
                    <strong>{goal.name}</strong>
                    <div className="muted small">até {date(goal.targetDate)}</div>
                  </div>
                  <button className="ghost small-btn" onClick={() => editor.edit(goal)}>
                    Editar
                  </button>
                </header>
                <div className="goal-amounts">
                  <strong>{money(goal.saved)}</strong>
                  <span className="muted"> de {money(goal.target)}</span>
                </div>
                <div className="bar goal-bar" role="progressbar" aria-valuenow={Math.round(plan.progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={goal.name}>
                  <div className="bar-fill" style={{ width: `${plan.progress * 100}%` }} />
                </div>
                <div className="goal-foot">
                  {plan.status === 'done' && <span className="status status-ok">✓ Meta atingida</span>}
                  {plan.status === 'active' && (
                    <span>
                      <strong>{money(plan.monthly)}/mês</strong>
                      <span className="muted small"> durante {plan.monthsLeft || 1} {plan.monthsLeft === 1 ? 'mês' : 'meses'}</span>
                    </span>
                  )}
                  {plan.status === 'overdue' && <span className="status status-over">✕ Prazo passou · faltam {money(plan.remaining)}</span>}
                  <span className="muted small">{percent(plan.progress)}</span>
                </div>
                {plan.status !== 'done' && (
                  <button className="ghost goal-add" onClick={() => setContribution({ goal, amount: Math.round(plan.monthly) || 50 })}>
                    + Adicionar poupança
                  </button>
                )}
              </article>
            ))}
          </div>
        ) : (
          <Empty>Ainda sem metas. Cria a primeira: uma viagem, a entrada da casa, um carro novo…</Empty>
        )}
      </Card>

      <EditDialog
        title={editor.isNew ? 'Nova meta' : 'Editar meta'}
        open={editor.open}
        onClose={editor.close}
        onSave={editor.save}
        onDelete={editor.isNew ? undefined : editor.remove}
      >
        {editor.draft && (
          <>
            <Field label="Nome">
              <input required value={editor.draft.name} onChange={(e) => editor.set('name', e.target.value)} placeholder="ex.: Viagem ao Japão" />
            </Field>
            <Field label="Valor objetivo (€)">
              <NumberInput value={editor.draft.target} onChange={(n) => editor.set('target', Math.max(0, n))} min={0} />
            </Field>
            <Field label="Já poupado (€)">
              <NumberInput value={editor.draft.saved} onChange={(n) => editor.set('saved', Math.max(0, n))} min={0} />
            </Field>
            <Field label="Data objetivo">
              <input type="date" required value={editor.draft.targetDate} onChange={(e) => editor.set('targetDate', e.target.value)} />
            </Field>
            <div className="full icon-picker" role="radiogroup" aria-label="Ícone">
              {ICONS.map((i) => (
                <button
                  type="button"
                  key={i}
                  role="radio"
                  aria-checked={editor.draft!.icon === i}
                  className={editor.draft!.icon === i ? 'on' : ''}
                  onClick={() => editor.set('icon', i)}
                >
                  {i}
                </button>
              ))}
            </div>
          </>
        )}
      </EditDialog>

      <EditDialog
        title={contribution ? `Adicionar a "${contribution.goal.name}"` : ''}
        open={contribution !== null}
        onClose={() => setContribution(null)}
        onSave={() => {
          if (contribution) upsert('goals', { ...contribution.goal, saved: contribution.goal.saved + contribution.amount });
          setContribution(null);
        }}
      >
        {contribution && (
          <Field label="Valor (€)">
            <NumberInput value={contribution.amount} onChange={(n) => setContribution({ ...contribution, amount: n })} />
          </Field>
        )}
      </EditDialog>
    </>
  );
}
