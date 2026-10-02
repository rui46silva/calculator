'use client';

import Link from 'next/link';
import { useStore } from '../data/store';
import type { BudgetRuleSettings, RuleBucket } from '../data/types';
import { Card, Empty, Field, NumberInput, Stat } from '../components/ui';
import { DEBT_SHARE, EMERGENCY_SHARE, rulePlan, type RulePlan } from '../lib/finance/budgetRule';
import { money, percent } from '../lib/format';
import { Sp500Strategy } from './Sp500Strategy';

const BUCKETS = [
  { key: 'needs', label: 'Necessidades', color: 'var(--series-1)' },
  { key: 'wants', label: 'Desejos', color: 'var(--series-2)' },
  { key: 'savings', label: 'Poupança e investimento', color: 'var(--series-3)' },
] as const;

const DEFAULT_SETTINGS: BudgetRuleSettings = { emergencyFund: 0, emergencyMonths: 6 };

export function BudgetRule() {
  const { data, update } = useStore();
  const settings = data.budgetRule ?? DEFAULT_SETTINGS;
  const plan = rulePlan(data);
  const setSettings = (patch: Partial<BudgetRuleSettings>) => update({ budgetRule: { ...settings, ...patch } });
  const setBucket = (key: string, bucket: RuleBucket) => setSettings({ overrides: { ...settings.overrides, [key]: bucket } });

  if (plan.income <= 0) {
    return (
      <>
        <h1>Plano 50/30/20</h1>
        <Card>
          <Empty>
            Para calcular o plano, adiciona primeiro os teus rendimentos e despesas em <Link href="/orcamento">Orçamento</Link>.
          </Empty>
        </Card>
      </>
    );
  }

  const share = (v: number) => percent(v / plan.income);

  return (
    <>
      <h1>Plano 50/30/20</h1>
      <p className="muted lead">
        Divide o rendimento líquido em <strong>50% necessidades</strong>, <strong>30% desejos</strong> e{' '}
        <strong>20% poupança e investimento</strong>. Calculado com tudo o que registaste em Orçamento, Créditos e Subscrições.
      </p>

      <div className="stats">
        <div className="stat hero-stat">
          <span className="stat-label">Valor ideal para investir por mês</span>
          <strong className="stat-value">{money(plan.invest)}</strong>
          <span className="stat-hint">
            {plan.maxInvest > plan.invest + 1 ? `Com o teu orçamento atual podes ir até ${money(plan.maxInvest)}` : 'Segundo a regra 50/30/20'}
          </span>
        </div>
        <Stat label="Rendimento líquido mensal" value={money(plan.income)} />
        <Stat
          label="Poupança atual"
          value={`${money(plan.actual.savings)} (${share(plan.actual.savings)})`}
          tone={plan.actual.savings >= plan.target.savings ? 'good' : 'bad'}
          hint={`Objetivo: ${money(plan.target.savings)} (20%)`}
        />
        <Stat
          label="Fundo de emergência"
          value={plan.emergency.gap > 0 ? `${percent(plan.emergency.target ? plan.emergency.current / plan.emergency.target : 0)} completo` : 'Completo'}
          hint={`Objetivo: ${money(plan.emergency.target)} (${settings.emergencyMonths} meses de necessidades)`}
          tone={plan.emergency.gap > 0 ? undefined : 'good'}
        />
      </div>

      <Card title="Ideal vs. atual">
        <RuleBars plan={plan} />
        <Advice plan={plan} />
      </Card>

      <div className="grid-2">
        <Card title="Como chegámos ao valor">
          <ol className="waterfall">
            <li>
              <span>20% do rendimento</span>
              <strong>{money(plan.target.savings)}</strong>
            </li>
            {plan.shortfall > 0 && (
              <li className="minus">
                <span>Falta no orçamento (gastas mais de 80%)</span>
                <strong>−{money(plan.shortfall)}</strong>
              </li>
            )}
            {plan.emergency.monthly > 0 && (
              <li className="minus">
                <span>
                  Fundo de emergência ({percent(EMERGENCY_SHARE)} até completar
                  {plan.emergency.monthsToTarget ? `, ~${plan.emergency.monthsToTarget} meses` : ''})
                </span>
                <strong>−{money(plan.emergency.monthly)}</strong>
              </li>
            )}
            {plan.debtExtra > 0 && (
              <li className="minus">
                <span>
                  Amortizar dívida cara ({percent(DEBT_SHARE)}): {plan.highInterestDebt.map((d) => `${d.name} ${percent(d.rate)}`).join(', ')}
                </span>
                <strong>−{money(plan.debtExtra)}</strong>
              </li>
            )}
            <li className="total">
              <span>Investir todos os meses</span>
              <strong>{money(plan.invest)}</strong>
            </li>
          </ol>
          <p className="muted small">
            Primeiro segurança, depois rendimento: o fundo de emergência evita vender investimentos numa queda, e dívidas com juros
            acima de 7% custam mais do que o mercado costuma render.
          </p>
        </Card>

        <Card title="Fundo de emergência">
          <div className="form-grid">
            <Field label="Já tenho guardado (€)">
              <NumberInput value={settings.emergencyFund} onChange={(n) => setSettings({ emergencyFund: Math.max(0, n) })} min={0} />
            </Field>
            <Field label="Objetivo">
              <div className="segmented" role="group" aria-label="Meses de reserva">
                {[3, 6, 9, 12].map((m) => (
                  <button key={m} className={settings.emergencyMonths === m ? 'on' : ''} onClick={() => setSettings({ emergencyMonths: m })}>
                    {m} meses
                  </button>
                ))}
              </div>
            </Field>
          </div>
          <div className="bar progress" aria-label="Progresso do fundo de emergência">
            <div
              className="bar-fill"
              style={{ width: `${Math.min(100, plan.emergency.target ? (plan.emergency.current / plan.emergency.target) * 100 : 100)}%` }}
            />
          </div>
          <p className="muted small">
            {money(plan.emergency.current)} de {money(plan.emergency.target)}. Guarda-o numa conta à ordem ou depósito com acesso imediato —
            não em ações. 6 meses é o recomendado para quem quer segurança; 3 meses se tiveres rendimentos muito estáveis.
          </p>
        </Card>
      </div>

      <Card title="Classificação das tuas despesas">
        <p className="muted small">Ajusta se alguma categoria estiver no grupo errado; o cálculo atualiza logo.</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Categoria</th>
                <th className="num">Por mês</th>
                <th className="num">% do rendimento</th>
                <th>Grupo</th>
              </tr>
            </thead>
            <tbody>
              {plan.lines.map((l) => (
                <tr key={l.key}>
                  <td>{l.label}</td>
                  <td className="num">{money(l.monthly)}</td>
                  <td className="num">{share(l.monthly)}</td>
                  <td>
                    <div className="segmented" role="group" aria-label={`Grupo de ${l.label}`}>
                      <button className={l.bucket === 'needs' ? 'on' : ''} onClick={() => setBucket(l.key, 'needs')}>
                        Necessidade
                      </button>
                      <button className={l.bucket === 'wants' ? 'on' : ''} onClick={() => setBucket(l.key, 'wants')}>
                        Desejo
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Sp500Strategy monthly={plan.invest} emergencyReady={plan.emergency.gap === 0} />
    </>
  );
}

/** Two 100% bars (ideal and actual) split into needs, wants and savings. */
function RuleBars({ plan }: { plan: RulePlan }) {
  const spent = plan.actual.needs + plan.actual.wants;
  const scale = Math.max(plan.income, spent);
  const rows = [
    { label: 'Ideal', values: plan.target },
    { label: 'Atual', values: plan.actual },
  ];
  return (
    <div className="rule-bars">
      <div className="chart-legend">
        {BUCKETS.map((b) => (
          <span key={b.key} className="chart-legend-item">
            <span className="chart-key band" style={{ background: b.color, opacity: 1 }} />
            {b.label}
          </span>
        ))}
      </div>
      {rows.map((r) => (
        <div key={r.label} className="rule-row">
          <span className="rule-row-label">{r.label}</span>
          <div className="rule-track">
            {BUCKETS.map((b) => {
              const v = r.values[b.key];
              if (v <= 0) return null;
              return (
                <div
                  key={b.key}
                  className="rule-seg"
                  style={{ width: `${(v / scale) * 100}%`, background: b.color }}
                  title={`${b.label}: ${money(v)} (${percent(v / plan.income)})`}
                />
              );
            })}
          </div>
        </div>
      ))}
      <div className="table-wrap">
        <table className="rule-table">
          <thead>
            <tr>
              <th />
              {BUCKETS.map((b) => (
                <th key={b.key} className="num">
                  {b.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td>{r.label}</td>
                {BUCKETS.map((b) => (
                  <td key={b.key} className="num">
                    {money(r.values[b.key])} <span className="muted small">({percent(r.values[b.key] / plan.income)})</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {spent > plan.income && <p className="bad small">Gastas {money(spent - plan.income)} por mês a mais do que ganhas.</p>}
    </div>
  );
}

function Advice({ plan }: { plan: RulePlan }) {
  const { data } = useStore();
  const tips: { tone: 'good' | 'bad' | 'info'; text: string }[] = [];
  const overNeeds = plan.actual.needs - plan.target.needs;
  const overWants = plan.actual.wants - plan.target.wants;

  if (plan.shortfall <= 0) tips.push({ tone: 'good', text: `Cumpres a regra: sobra pelo menos 20% do rendimento para poupar e investir.` });
  if (overWants > 0) {
    const rarely = data.subscriptions.filter((s) => s.rarelyUsed).map((s) => s.name);
    tips.push({
      tone: 'bad',
      text: `Os desejos estão ${money(overWants)}/mês acima dos 30%.${rarely.length ? ` Começa pelas subscrições que usas pouco: ${rarely.join(', ')}.` : ''}`,
    });
  }
  if (overNeeds > 0) {
    tips.push({
      tone: 'info',
      text: `As necessidades estão ${money(overNeeds)}/mês acima dos 50%. É comum com crédito à habitação ou renda alta; reveja seguros, tarifários e a taxa do crédito, e compensa reduzindo os desejos.`,
    });
  }
  if (plan.shortfall > 0) {
    tips.push({ tone: 'bad', text: `Para chegares aos 20% precisas de libertar ${money(plan.shortfall)}/mês.` });
  }
  if (!tips.length) return null;
  return (
    <ul className="advice">
      {tips.map((t, i) => (
        <li key={i} className={`advice-${t.tone}`}>
          <span aria-hidden>{t.tone === 'good' ? '✓' : t.tone === 'bad' ? '!' : 'i'}</span>
          {t.text}
        </li>
      ))}
    </ul>
  );
}
