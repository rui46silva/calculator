'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useStore } from '../data/store';
import { Card, Field, NumberInput, Stat } from '../components/ui';
import { TimeChart } from '../components/TimeChart';
import { monthlyReturns, seriesStats, simulate } from '../lib/finance/market';
import { ETF_PRESETS, SYMBOL_PATTERN } from '../lib/market/types';
import { useMarket } from '../lib/useMarket';
import { money, percent } from '../lib/format';

const RANGES = [
  { label: '5 anos', months: 60 },
  { label: '10 anos', months: 120 },
  { label: 'Tudo', months: Infinity },
];

const compact = new Intl.NumberFormat('pt-PT', { notation: 'compact', maximumFractionDigits: 1 });
const monthYear = (t: number) => new Date(t).toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' });

function priceFormatter(currency: string) {
  try {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: currency || 'EUR' });
  } catch {
    return new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 2 });
  }
}

/**
 * Pick an ETF, see its real price history, and project a monthly investment by resampling
 * its actual monthly returns (block bootstrap) into pessimistic/base/optimistic outcomes.
 */
export function EtfAnalysis({ initialValue, monthly, onAddToPortfolio }: { initialValue: number; monthly: number; onAddToPortfolio: (symbol: string, name: string) => void }) {
  const { data: appData, update } = useStore();
  const [symbol, setSymbol] = useState(appData.marketAssumptions?.symbol ?? ETF_PRESETS[0].symbol);
  const [custom, setCustom] = useState('');
  const [range, setRange] = useState(RANGES[1]);
  const [start, setStart] = useState(Math.round(initialValue));
  const [contrib, setContrib] = useState(monthly || 200);
  const [years, setYears] = useState(15);
  const { data: series, error, loading } = useMarket(symbol);

  const stats = useMemo(() => (series ? seriesStats(series.points) : null), [series]);
  const sim = useMemo(() => {
    if (!series || series.points.length < 24) return null;
    return simulate({ returns: monthlyReturns(series.points), initial: start, monthlyContribution: contrib, years, paths: 2000 });
  }, [series, start, contrib, years]);

  const shown = useMemo(() => (series ? series.points.slice(-Math.min(series.points.length, range.months + 1)) : []), [series, range]);
  const fmtPrice = priceFormatter(series?.currency ?? 'EUR');
  const applied = appData.marketAssumptions?.symbol === series?.symbol;

  const submitCustom = (e: FormEvent) => {
    e.preventDefault();
    const s = custom.trim().toUpperCase();
    if (SYMBOL_PATTERN.test(s)) setSymbol(s);
  };

  const applyToScenarios = () => {
    if (!series || !sim) return;
    update({
      marketAssumptions: {
        symbol: series.symbol,
        name: series.name,
        pessimistic: sim.annualRates.p10,
        base: sim.annualRates.p50,
        optimistic: sim.annualRates.p90,
        appliedAt: Date.now(),
      },
    });
  };

  return (
    <Card title="Análise de ETF">
      <div className="etf-picker">
        <Field label="ETF">
          <select value={ETF_PRESETS.some((p) => p.symbol === symbol) ? symbol : ''} onChange={(e) => e.target.value && setSymbol(e.target.value)}>
            {!ETF_PRESETS.some((p) => p.symbol === symbol) && <option value="">{symbol}</option>}
            {[...new Set(ETF_PRESETS.map((p) => p.group))].map((g) => (
              <optgroup key={g} label={g}>
                {ETF_PRESETS.filter((p) => p.group === g).map((p) => (
                  <option key={p.symbol} value={p.symbol}>
                    {p.name} · {p.symbol}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
        <form onSubmit={submitCustom} className="etf-custom">
          <Field label="Outro ticker (Yahoo Finance)">
            <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="ex.: CSPX.L, QQQ, IWDA.AS" />
          </Field>
          <button type="submit" className="ghost">
            Analisar
          </button>
        </form>
      </div>

      {error && (
        <p className="bad" role="alert">
          {error}
        </p>
      )}

      {series && stats && (
        <div className={loading ? 'refetching' : undefined}>
          <div className="etf-head">
            <div>
              <strong>{series.name}</strong>
              <div className="muted small">
                {series.symbol} · {series.currency || 'moeda desconhecida'} · cotação de {new Date(series.asOf).toLocaleString('pt-PT')}
                {series.source === 'stooq' && ' · fonte: Stooq (sem dividendos)'}
              </div>
            </div>
            <div className="etf-price">{fmtPrice.format(series.price)}</div>
          </div>

          <div className="stats">
            {stats.trailing
              .filter((t) => [1, 5, 10].includes(t.years))
              .map((t) => (
                <Stat key={t.years} label={`Rentab. anual · ${t.years} ${t.years === 1 ? 'ano' : 'anos'}`} value={percent(t.cagr)} tone={t.cagr >= 0 ? 'good' : 'bad'} />
              ))}
            <Stat label={`Rentab. anual · ${stats.years.toFixed(0)} anos (tudo)`} value={percent(stats.cagr)} />
            <Stat label="Volatilidade anual" value={percent(stats.volatility)} />
            <Stat label="Pior queda (máx. drawdown)" value={percent(stats.maxDrawdown)} tone="bad" />
          </div>

          <div className="card-header chart-header">
            <h3>Cotação mensal</h3>
            <div className="segmented" role="group" aria-label="Período">
              {RANGES.map((r) => (
                <button key={r.label} className={r === range ? 'on' : ''} onClick={() => setRange(r)}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <TimeChart
            ariaLabel={`Cotação mensal de ${series.symbol}`}
            x={shown.map((p) => p.t)}
            series={[{ kind: 'line', key: 'price', label: series.symbol, color: 'var(--series-1)', values: shown.map((p) => p.close) }]}
            formatX={monthYear}
            formatY={(v) => fmtPrice.format(v)}
            formatTick={(v) => compact.format(v)}
          />
          {series.source === 'yahoo' && <p className="muted small">Preços ajustados a dividendos e desdobramentos.</p>}

          <h3 className="section-title">Simulação com base no histórico</h3>
          <div className="form-grid">
            <Field label="Valor inicial (€)">
              <NumberInput value={start} onChange={setStart} min={0} />
            </Field>
            <Field label="Investimento mensal (€)">
              <NumberInput value={contrib} onChange={setContrib} min={0} />
            </Field>
            <Field label="Horizonte (anos)">
              <NumberInput value={years} onChange={(n) => setYears(Math.min(Math.max(1, Math.round(n)), 40))} step="1" min={1} />
            </Field>
          </div>

          {sim ? (
            <>
              <div className="stats">
                <Stat label="Pessimista (10% piores)" value={money(sim.years[years].p10)} hint={`${percent(sim.annualRates.p10)}/ano`} />
                <Stat label="Base (mediana)" value={money(sim.years[years].p50)} hint={`${percent(sim.annualRates.p50)}/ano`} />
                <Stat label="Otimista (10% melhores)" value={money(sim.years[years].p90)} hint={`${percent(sim.annualRates.p90)}/ano`} />
                <Stat label="Total investido" value={money(sim.years[years].contributed)} hint={`Prob. de perder dinheiro: ${percent(sim.lossProbability)}`} />
              </div>
              <TimeChart
                ariaLabel="Projeção do valor investido: intervalo entre cenário pessimista e otimista, mediana e total investido"
                x={sim.years.map((y) => y.year)}
                series={[
                  { kind: 'band', key: 'range', label: 'Pessimista – otimista', color: 'var(--series-1)', lower: sim.years.map((y) => y.p10), upper: sim.years.map((y) => y.p90) },
                  { kind: 'line', key: 'p50', label: 'Base (mediana)', color: 'var(--series-1)', values: sim.years.map((y) => y.p50) },
                  { kind: 'line', key: 'contrib', label: 'Total investido', color: 'var(--series-2)', values: sim.years.map((y) => y.contributed), dashed: true },
                ]}
                formatX={(y) => (y === 0 ? 'Hoje' : `Ano ${y}`)}
                formatY={money}
                formatTick={(v) => compact.format(v)}
              />
              <details className="table-details">
                <summary>Ver tabela</summary>
                <div className="table-wrap tall">
                  <table>
                    <thead>
                      <tr>
                        <th>Ano</th>
                        <th className="num">Investido</th>
                        <th className="num">Pessimista</th>
                        <th className="num">Base</th>
                        <th className="num">Otimista</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sim.years.slice(1).map((y) => (
                        <tr key={y.year}>
                          <td>{y.year}</td>
                          <td className="num">{money(y.contributed)}</td>
                          <td className="num">{money(y.p10)}</td>
                          <td className="num">{money(y.p50)}</td>
                          <td className="num">{money(y.p90)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
              <p className="muted small">
                2000 simulações construídas a partir de blocos de 12 meses reais de {series.symbol} ({stats.years.toFixed(0)} anos de
                histórico). Rentabilidades passadas não garantem resultados futuros; valores nominais, antes de impostos.
              </p>
              <div className="preset-row">
                <button onClick={applyToScenarios} disabled={applied && appData.marketAssumptions?.base === sim.annualRates.p50}>
                  {applied ? 'Atualizar nos Cenários' : 'Usar nos Cenários'}
                </button>
                <button className="ghost" onClick={() => onAddToPortfolio(series.symbol, series.name)}>
                  Adicionar à carteira
                </button>
              </div>
              {applied && <p className="good small">Os presets da página Cenários usam as rentabilidades de {series.symbol}.</p>}
            </>
          ) : (
            <p className="muted">Histórico insuficiente para simular (mínimo 2 anos).</p>
          )}
        </div>
      )}
      {!series && !error && <p className="muted">A carregar cotações…</p>}
    </Card>
  );
}
