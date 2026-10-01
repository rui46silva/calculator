'use client';

import { useEffect, useState } from 'react';
import { useStore, newId } from '../data/store';
import { ASSET_CLASSES, type Investment } from '../data/types';
import { Card, Empty, Field, NumberInput, PercentInput, Select, Stat } from '../components/ui';
import { EditDialog } from '../components/EditDialog';
import { useEditor } from '../components/useEditor';
import { financialIndependenceTarget, PT_CAPITAL_GAINS_TAX } from '../lib/finance/invest';
import { money, percent } from '../lib/format';
import { monthlySummary } from '../lib/summary';
import { fetchSeries } from '../lib/useMarket';
import { SYMBOL_PATTERN } from '../lib/market/types';
import { EtfAnalysis } from './EtfAnalysis';

interface Quote {
  price: number;
  currency: string;
  asOf: number;
}

/** Live quotes for every holding that has a ticker; keeps stored values in step with the market. */
function useLiveQuotes(investments: Investment[], onValue: (inv: Investment, value: number) => void) {
  const [quotes, setQuotes] = useState<Record<string, Quote | { error: string }>>({});
  const tickers = [...new Set(investments.map((i) => i.ticker?.toUpperCase()).filter((t): t is string => !!t && SYMBOL_PATTERN.test(t)))];
  const key = tickers.join(',');

  useEffect(() => {
    let cancelled = false;
    for (const t of tickers) {
      fetchSeries(t).then(
        (s) => !cancelled && setQuotes((q) => ({ ...q, [t]: { price: s.price, currency: s.currency, asOf: s.asOf } })),
        (err: Error) => !cancelled && setQuotes((q) => ({ ...q, [t]: { error: err.message } })),
      );
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    for (const inv of investments) {
      const q = inv.ticker ? quotes[inv.ticker.toUpperCase()] : undefined;
      if (!q || 'error' in q || !inv.units) continue;
      const value = Math.round(inv.units * q.price * 100) / 100;
      if (Math.abs(value - inv.currentValue) > 0.01) onValue(inv, value);
    }
  }, [quotes, investments, onValue]);

  return quotes;
}

export function Investments() {
  const { data, upsert } = useStore();
  const editor = useEditor(
    'investments',
    (): Investment => ({ id: newId(), name: '', assetClass: ASSET_CLASSES[0], invested: 0, currentValue: 0, monthlyContribution: 0 }),
  );
  const quotes = useLiveQuotes(data.investments, (inv, value) => upsert('investments', { ...inv, currentValue: value }));

  const invested = data.investments.reduce((a, i) => a + i.invested, 0);
  const value = data.investments.reduce((a, i) => a + i.currentValue, 0);
  const contributions = data.investments.reduce((a, i) => a + i.monthlyContribution, 0);
  const gain = value - invested;

  const allocation = new Map<string, number>();
  for (const i of data.investments) allocation.set(i.assetClass, (allocation.get(i.assetClass) ?? 0) + i.currentValue);

  const addFromEtf = (symbol: string, name: string) => {
    editor.add();
    editor.set('name', name);
    editor.set('ticker', symbol);
    editor.set('assetClass', 'ETF');
  };

  const draftQuote = editor.draft?.ticker ? quotes[editor.draft.ticker.toUpperCase()] : undefined;

  return (
    <>
      <h1>Investimentos</h1>
      <div className="stats">
        <Stat label="Valor atual" value={money(value)} />
        <Stat label="Total investido" value={money(invested)} />
        <Stat
          label="Mais/menos-valia"
          value={`${money(gain)} (${percent(invested > 0 ? gain / invested : 0)})`}
          hint={gain > 0 ? `Imposto estimado (28%): ${money(gain * PT_CAPITAL_GAINS_TAX)}` : undefined}
          tone={gain >= 0 ? 'good' : 'bad'}
        />
        <Stat label="Contribuição mensal" value={money(contributions)} />
      </div>

      <div className="grid-2">
        <Card title="Carteira" actions={<button onClick={editor.add}>+ Adicionar</button>}>
          {data.investments.length ? (
            <ul className="list clickable">
              {data.investments.map((i) => {
                const q = i.ticker ? quotes[i.ticker.toUpperCase()] : undefined;
                return (
                  <li key={i.id} onClick={() => editor.edit(i)}>
                    <span>
                      {i.name}
                      {i.ticker && <span className="tag">{i.ticker.toUpperCase()}</span>}
                    </span>
                    <span className="muted">
                      {i.assetClass}
                      {q && !('error' in q) && i.units ? ` · ${i.units} × ${q.price.toFixed(2)} ${q.currency}` : ''}
                      {q && 'error' in q ? ' · cotação indisponível' : ''}
                    </span>
                    <strong className={i.currentValue >= i.invested ? 'good' : 'bad'}>{money(i.currentValue)}</strong>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty>Adiciona ETFs, PPR, certificados de aforro, depósitos… Com ticker e unidades, o valor segue o mercado.</Empty>
          )}
        </Card>

        <Card title="Alocação">
          {value > 0 ? (
            <div className="breakdown">
              {[...allocation].sort((a, b) => b[1] - a[1]).map(([cls, v]) => (
                <div key={cls} className="bar-row">
                  <span>{cls}</span>
                  <div className="bar">
                    <div className="bar-fill" style={{ width: `${(v / value) * 100}%` }} />
                  </div>
                  <span className="num">{percent(v / value)}</span>
                </div>
              ))}
            </div>
          ) : (
            <Empty>Sem dados.</Empty>
          )}
        </Card>
      </div>

      <EtfAnalysis initialValue={value} monthly={contributions} onAddToPortfolio={addFromEtf} />
      <IndependenceCalculator />

      <EditDialog
        title={editor.isNew ? 'Novo investimento' : 'Editar investimento'}
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
            <Field label="Classe de ativo">
              <Select value={editor.draft.assetClass} options={ASSET_CLASSES} onChange={(v) => editor.set('assetClass', v)} />
            </Field>
            <Field label="Ticker (opcional)">
              <input
                value={editor.draft.ticker ?? ''}
                onChange={(e) => editor.set('ticker', e.target.value.trim().toUpperCase() || undefined)}
                placeholder="ex.: SXR8.DE"
                pattern={SYMBOL_PATTERN.source}
              />
            </Field>
            <Field label="Unidades">
              <NumberInput value={editor.draft.units ?? 0} onChange={(n) => editor.set('units', n || undefined)} min={0} />
            </Field>
            <Field label="Total investido (€)">
              <NumberInput value={editor.draft.invested} onChange={(n) => editor.set('invested', n)} min={0} />
            </Field>
            <Field label={editor.draft.ticker && editor.draft.units ? 'Valor atual (€) · automático' : 'Valor atual (€)'}>
              <NumberInput value={editor.draft.currentValue} onChange={(n) => editor.set('currentValue', n)} min={0} />
            </Field>
            <Field label="Contribuição mensal (€)">
              <NumberInput value={editor.draft.monthlyContribution} onChange={(n) => editor.set('monthlyContribution', n)} min={0} />
            </Field>
            {draftQuote && !('error' in draftQuote) && draftQuote.currency && draftQuote.currency !== 'EUR' && (
              <p className="muted small full">
                Atenção: {editor.draft.ticker} cota em {draftQuote.currency}; o valor não é convertido para euros.
              </p>
            )}
          </>
        )}
      </EditDialog>
    </>
  );
}

function IndependenceCalculator() {
  const { data } = useStore();
  const s = monthlySummary(data);
  const [spending, setSpending] = useState(Math.round((s.expenses + s.subscriptions) * 12) || 24_000);
  const [rate, setRate] = useState(0.04);
  const target = financialIndependenceTarget(spending, rate);

  return (
    <Card title="Independência financeira">
      <div className="form-grid">
        <Field label="Despesa anual desejada (€)">
          <NumberInput value={spending} onChange={setSpending} min={0} />
        </Field>
        <Field label="Taxa de levantamento (%)">
          <PercentInput value={rate} onChange={setRate} />
        </Field>
      </div>
      <p>
        Precisas de uma carteira de <strong>{money(target)}</strong> para viver dos rendimentos.{' '}
        {s.portfolioValue > 0 && <>Já tens {percent(Math.min(s.portfolioValue / target, 1))} do objetivo.</>}
      </p>
    </Card>
  );
}
