'use client';

import { useMemo, useState } from 'react';
import { useStore } from '../data/store';
import { Card, Field, NumberInput, PercentInput, Stat } from '../components/ui';
import { projectScenario, type ScenarioInput } from '../lib/summary';
import Link from 'next/link';
import { money, percent } from '../lib/format';

const PRESETS: Record<string, Omit<ScenarioInput, 'years' | 'investShare'>> = {
  Pessimista: { inflation: 0.035, incomeGrowth: 0.01, investmentReturn: 0.02 },
  Base: { inflation: 0.02, incomeGrowth: 0.025, investmentReturn: 0.05 },
  Otimista: { inflation: 0.015, incomeGrowth: 0.04, investmentReturn: 0.08 },
};

type PresetName = keyof typeof PRESETS;

export function Scenarios() {
  const { data } = useStore();
  const market = data.marketAssumptions;
  /** Presets keep their inflation/salary assumptions but take investment returns from the applied ETF analysis. */
  const preset = (name: PresetName) => {
    const p = PRESETS[name];
    if (!market) return p;
    const rates: Record<PresetName, number> = { Pessimista: market.pessimistic, Base: market.base, Otimista: market.optimistic };
    return { ...p, investmentReturn: rates[name] };
  };
  const [input, setInput] = useState<ScenarioInput>(() => ({ years: 15, investShare: 0.5, ...preset('Base') }));
  const set = <K extends keyof ScenarioInput>(k: K, v: ScenarioInput[K]) => setInput((i) => ({ ...i, [k]: v }));

  const years = useMemo(() => projectScenario(data, input), [data, input]);
  const last = years.at(-1);
  const debtFreeYear = years.find((y) => y.debtBalance < 1)?.year;
  const maxNetWorth = Math.max(1, ...years.map((y) => Math.abs(y.netWorth)));

  return (
    <>
      <h1>Cenários</h1>
      <Card title="Pressupostos">
        {market && (
          <p className="note">
            Rentabilidades dos presets baseadas no histórico de <strong>{market.name}</strong> ({market.symbol}): pessimista{' '}
            {percent(market.pessimistic)}, base {percent(market.base)}, otimista {percent(market.optimistic)} por ano. Podes mudar o
            ETF em <Link href="/investimentos">Investimentos</Link>.
          </p>
        )}
        <div className="preset-row">
          {(Object.keys(PRESETS) as PresetName[]).map((name) => (
            <button key={name} className="ghost" onClick={() => setInput((i) => ({ ...i, ...preset(name) }))}>
              {name}
            </button>
          ))}
        </div>
        <div className="form-grid">
          <Field label="Horizonte (anos)">
            <NumberInput value={input.years} onChange={(n) => set('years', Math.min(Math.max(1, Math.round(n)), 40))} step="1" min={1} />
          </Field>
          <Field label="Inflação anual (%)">
            <PercentInput value={input.inflation} onChange={(n) => set('inflation', n)} />
          </Field>
          <Field label="Aumento salarial anual (%)">
            <PercentInput value={input.incomeGrowth} onChange={(n) => set('incomeGrowth', n)} />
          </Field>
          <Field label="Rentabilidade dos investimentos (%)">
            <PercentInput value={input.investmentReturn} onChange={(n) => set('investmentReturn', n)} />
          </Field>
          <Field label="% do excedente investido">
            <PercentInput value={input.investShare} onChange={(n) => set('investShare', Math.min(Math.max(n, 0), 1))} />
          </Field>
        </div>
      </Card>

      {last && (
        <div className="stats">
          <Stat label={`Património líquido em ${last.year}`} value={money(last.netWorth)} tone={last.netWorth >= 0 ? 'good' : 'bad'} />
          <Stat label="Carteira de investimentos" value={money(last.portfolio)} />
          <Stat label="Liquidez acumulada" value={money(last.cash)} />
          <Stat label="Livre de dívidas" value={debtFreeYear ? String(debtFreeYear) : `Depois de ${last.year}`} />
        </div>
      )}

      <Card title="Evolução ano a ano">
        <div className="table-wrap tall">
          <table>
            <thead>
              <tr>
                <th>Ano</th>
                <th className="num">Rendimento</th>
                <th className="num">Despesas</th>
                <th className="num">Prestações</th>
                <th className="num">Excedente</th>
                <th className="num">Dívida</th>
                <th className="num">Património</th>
                <th className="hide-mobile" />
              </tr>
            </thead>
            <tbody>
              {years.map((y) => (
                <tr key={y.year}>
                  <td>{y.year}</td>
                  <td className="num">{money(y.income)}</td>
                  <td className="num">{money(y.expenses)}</td>
                  <td className="num">{money(y.debtPayments)}</td>
                  <td className={`num ${y.surplus < 0 ? 'bad' : ''}`}>{money(y.surplus)}</td>
                  <td className="num">{money(y.debtBalance)}</td>
                  <td className="num">{money(y.netWorth)}</td>
                  <td className="hide-mobile spark">
                    <div className={`bar-fill ${y.netWorth < 0 ? 'neg' : ''}`} style={{ width: `${(Math.abs(y.netWorth) / maxNetWorth) * 100}%` }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">
          Valores nominais. As despesas e subscrições crescem com a inflação; os créditos seguem o plano de amortização atual.
        </p>
      </Card>
    </>
  );
}
