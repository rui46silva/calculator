import { useMemo, useState } from 'react';
import { useStore, newId } from '../data/store';
import { ASSET_CLASSES, type Investment } from '../data/types';
import { Card, Empty, Field, NumberInput, PercentInput, Select, Stat } from '../components/ui';
import { EditDialog } from '../components/EditDialog';
import { useEditor } from '../components/useEditor';
import { financialIndependenceTarget, projectGrowth, PT_CAPITAL_GAINS_TAX } from '../lib/finance/invest';
import { money, percent } from '../lib/format';
import { monthlySummary } from '../lib/summary';

export function Investments() {
  const { data } = useStore();
  const editor = useEditor(
    'investments',
    (): Investment => ({ id: newId(), name: '', assetClass: ASSET_CLASSES[0], invested: 0, currentValue: 0, monthlyContribution: 0 }),
  );

  const invested = data.investments.reduce((a, i) => a + i.invested, 0);
  const value = data.investments.reduce((a, i) => a + i.currentValue, 0);
  const contributions = data.investments.reduce((a, i) => a + i.monthlyContribution, 0);
  const gain = value - invested;

  const allocation = new Map<string, number>();
  for (const i of data.investments) allocation.set(i.assetClass, (allocation.get(i.assetClass) ?? 0) + i.currentValue);

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
              {data.investments.map((i) => (
                <li key={i.id} onClick={() => editor.edit(i)}>
                  <span>{i.name}</span>
                  <span className="muted">{i.assetClass}</span>
                  <strong className={i.currentValue >= i.invested ? 'good' : 'bad'}>{money(i.currentValue)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Adiciona ETFs, PPR, certificados de aforro, depósitos…</Empty>
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

      <GrowthSimulator initial={value} monthly={contributions} />
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
            <Field label="Total investido (€)">
              <NumberInput value={editor.draft.invested} onChange={(n) => editor.set('invested', n)} min={0} />
            </Field>
            <Field label="Valor atual (€)">
              <NumberInput value={editor.draft.currentValue} onChange={(n) => editor.set('currentValue', n)} min={0} />
            </Field>
            <Field label="Contribuição mensal (€)">
              <NumberInput value={editor.draft.monthlyContribution} onChange={(n) => editor.set('monthlyContribution', n)} min={0} />
            </Field>
          </>
        )}
      </EditDialog>
    </>
  );
}

function GrowthSimulator({ initial, monthly }: { initial: number; monthly: number }) {
  const [start, setStart] = useState(initial);
  const [contrib, setContrib] = useState(monthly || 200);
  const [rate, setRate] = useState(0.06);
  const [years, setYears] = useState(20);
  const [inflation, setInflation] = useState(0.02);

  const points = useMemo(
    () => projectGrowth({ initial: start, monthlyContribution: contrib, annualReturn: rate, years, inflation }),
    [start, contrib, rate, years, inflation],
  );
  const last = points.at(-1)!;
  const max = Math.max(1, last.value);
  const step = Math.max(1, Math.ceil(years / 20));

  return (
    <Card title="Simulador de juros compostos">
      <div className="form-grid">
        <Field label="Valor inicial (€)">
          <NumberInput value={start} onChange={setStart} min={0} />
        </Field>
        <Field label="Contribuição mensal (€)">
          <NumberInput value={contrib} onChange={setContrib} min={0} />
        </Field>
        <Field label="Rentabilidade anual (%)">
          <PercentInput value={rate} onChange={setRate} />
        </Field>
        <Field label="Anos">
          <NumberInput value={years} onChange={(n) => setYears(Math.min(Math.max(1, Math.round(n)), 50))} step="1" min={1} />
        </Field>
        <Field label="Inflação (%)">
          <PercentInput value={inflation} onChange={setInflation} />
        </Field>
      </div>
      <div className="stats">
        <Stat label={`Valor final (${years} anos)`} value={money(last.value)} />
        <Stat label="Em dinheiro de hoje" value={money(last.realValue)} />
        <Stat label="Total contribuído" value={money(last.contributed)} />
        <Stat label="Ganho com juros" value={money(last.value - last.contributed)} tone="good" />
      </div>
      <div className="columns" role="img" aria-label="Evolução do valor investido">
        {points
          .filter((p) => p.year > 0 && (p.year % step === 0 || p.year === years))
          .map((p) => (
            <div key={p.year} className="column" title={`Ano ${p.year}: ${money(p.value)}`}>
              <div className="column-bar" style={{ height: `${(p.value / max) * 100}%` }}>
                <div className="column-contrib" style={{ height: `${(p.contributed / p.value) * 100}%` }} />
              </div>
              <span className="column-label">{p.year}</span>
            </div>
          ))}
      </div>
      <p className="muted small">
        <span className="legend contrib" /> Contribuído <span className="legend growth" /> Juros
      </p>
    </Card>
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
