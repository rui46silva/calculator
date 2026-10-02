'use client';

import { useMemo } from 'react';
import { useStore, newId } from '../data/store';
import type { Investment } from '../data/types';
import { Card, Stat } from '../components/ui';
import { monthlyReturns, rollingReturns, seriesStats, simulate } from '../lib/finance/market';
import { useMarket } from '../lib/useMarket';
import { money, percent } from '../lib/format';

/** Long, dividend-adjusted S&P 500 history (since 1993) for the statistics. */
const HISTORY_SYMBOL = 'SPY';
/** The UCITS, EUR-listed accumulating ETF the plan suggests buying. */
const PLAN_SYMBOL = 'SXR8.DE';
const PLAN_NAME = 'S&P 500 · plano mensal';
const HORIZONS = [10, 20, 30];
const compactMoney = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', notation: 'compact', maximumSignificantDigits: 3 });

export function Sp500Strategy({ monthly, emergencyReady }: { monthly: number; emergencyReady: boolean }) {
  const { data, upsert } = useStore();
  const { data: series, error } = useMarket(HISTORY_SYMBOL);

  const analysis = useMemo(() => {
    if (!series || series.points.length < 13 * 12) return null;
    const stats = seriesStats(series.points);
    const r10 = rollingReturns(series.points, 10);
    const r20 = rollingReturns(series.points, 20);
    const sim = monthly > 0 ? simulate({ returns: monthlyReturns(series.points), initial: 0, monthlyContribution: monthly, years: 30 }) : null;
    return { stats, r10, r20, sim };
  }, [series, monthly]);

  const existing = data.investments.find((i) => i.ticker?.toUpperCase() === PLAN_SYMBOL);
  const planned = existing && Math.abs(existing.monthlyContribution - monthly) < 0.5;

  const createPlan = () => {
    const base: Investment = existing ?? {
      id: newId(),
      name: PLAN_NAME,
      assetClass: 'ETF',
      invested: 0,
      currentValue: 0,
      monthlyContribution: 0,
      ticker: PLAN_SYMBOL,
    };
    upsert('investments', { ...base, monthlyContribution: Math.round(monthly * 100) / 100 });
  };

  const a = analysis;
  const steps: { title: string; body: string; done?: boolean }[] = [
    {
      title: 'Fundo de emergência primeiro',
      body: emergencyReady
        ? 'Já tens o fundo de emergência completo. Podes investir com tranquilidade.'
        : 'Enquanto não estiver completo, o plano acima já desvia parte da poupança para ele. Nunca invistas dinheiro de que possas precisar nos próximos anos.',
      done: emergencyReady,
    },
    {
      title: 'Escolhe um ETF S&P 500 de acumulação, em euros',
      body: 'Ex.: iShares Core S&P 500 (SXR8 / CSPX) ou Vanguard S&P 500 (VUAA), ambos UCITS com custos anuais de cerca de 0,07%. "Acumulação" significa que os dividendos são reinvestidos automaticamente; em Portugal só pagas 28% sobre as mais-valias quando venderes.',
    },
    {
      title: `Investe ${monthly > 0 ? money(monthly) : 'o mesmo valor'} todos os meses, no mesmo dia`,
      body: 'É o investimento periódico (DCA): logo a seguir a receberes o salário, sem tentar adivinhar o melhor momento. Usa um plano de investimento automático numa corretora regulada na UE; assim compras mais unidades quando o preço está baixo e menos quando está alto.',
    },
    {
      title: 'Pensa a 10 anos ou mais',
      body: a?.r10
        ? `Desde ${new Date(series!.points[0].t).getFullYear()}, ${percent(a.r10.lossShare)} dos períodos de 10 anos acabaram a perder (pior: ${percent(a.r10.worst)}/ano; mediana: ${percent(a.r10.median)}/ano)${a.r20 ? `, e ${percent(a.r20.lossShare)} dos de 20 anos` : ''}. Quanto maior o prazo, menor o risco de perda.`
        : 'Historicamente, quanto maior o prazo, menor a probabilidade de perder dinheiro no S&P 500. Dinheiro para os próximos 5 anos não deve ir para ações.',
    },
    {
      title: 'Não vendas nas quedas',
      body: a
        ? `A pior queda neste histórico foi de ${percent(a.stats.maxDrawdown)}. Quedas de 20% a 35% acontecem a cada poucos anos; continuar a investir durante elas é o que mais contribui para o resultado final.`
        : 'Quedas de 20% a 35% acontecem a cada poucos anos. Continuar a investir durante elas é o que mais contribui para o resultado final.',
    },
    {
      title: 'Revê uma vez por ano',
      body: 'Aumenta o valor mensal quando o salário sobe e confirma que o fundo de emergência continua completo. Não precisas de acompanhar o preço diariamente.',
    },
    {
      title: 'Conhece o risco de concentração',
      body: 'O S&P 500 são as 500 maiores empresas dos EUA, com grande peso de tecnologia e exposição ao dólar. Para mais diversificação podes, no futuro, juntar um ETF global (MSCI World ou FTSE All-World).',
    },
  ];

  return (
    <Card title="Estratégia: investir no S&P 500 todos os meses">
      <div className="strategy">
        <ol className="strategy-steps">
          {steps.map((s, i) => (
            <li key={s.title} className={s.done ? 'done' : ''}>
              <span className="step-num" aria-hidden>
                {s.done ? '✓' : i + 1}
              </span>
              <div>
                <strong>{s.title}</strong>
                <p className="muted">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="strategy-numbers">
          <h3>O que o histórico diz</h3>
          {error && <p className="muted small">Cotações indisponíveis de momento ({error}).</p>}
          {!a && !error && <p className="muted small">A carregar o histórico do S&P 500…</p>}
          {a && (
            <>
              <div className="stats compact">
                <Stat label={`Rentab. anual (${a.stats.years.toFixed(0)} anos)`} value={percent(a.stats.cagr)} />
                <Stat label="Pior queda" value={percent(a.stats.maxDrawdown)} tone="bad" />
                {a.r10 && <Stat label="Períodos de 10 anos com perda" value={percent(a.r10.lossShare)} />}
              </div>
              {a.sim ? (
                <>
                  <h3>Se investires {money(monthly)}/mês</h3>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Prazo</th>
                          <th className="num hide-mobile">Investido</th>
                          <th className="num">Pessimista</th>
                          <th className="num">Base</th>
                          <th className="num">Otimista</th>
                        </tr>
                      </thead>
                      <tbody>
                        {HORIZONS.map((h) => {
                          const y = a.sim!.years[h];
                          return (
                            <tr key={h}>
                              <td>
                                <span className="nowrap">{h} anos</span>
                                <div className="muted small show-mobile">investes {compactMoney.format(y.contributed)}</div>
                              </td>
                              <td className="num hide-mobile" title={money(y.contributed)}>
                                {compactMoney.format(y.contributed)}
                              </td>
                              <td className="num" title={money(y.p10)}>{compactMoney.format(y.p10)}</td>
                              <td className="num" title={money(y.p50)}>{compactMoney.format(y.p50)}</td>
                              <td className="num" title={money(y.p90)}>{compactMoney.format(y.p90)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="muted small">
                    Simulação com blocos reais de 12 meses do {HISTORY_SYMBOL} (dividendos incluídos, em dólares). Pessimista = 10% piores
                    resultados. Valores nominais, antes de impostos. Rentabilidades passadas não garantem resultados futuros.
                  </p>
                </>
              ) : (
                <p className="muted small">Quando o plano tiver um valor para investir, mostramos aqui a projeção.</p>
              )}
            </>
          )}
          {monthly > 0 && (
            <div className="preset-row">
              <button onClick={createPlan} disabled={planned}>
                {planned ? 'Plano registado na carteira' : existing ? `Atualizar plano para ${money(monthly)}/mês` : `Registar plano de ${money(monthly)}/mês`}
              </button>
            </div>
          )}
          {planned && <p className="good small">Em Investimentos, adiciona as unidades que fores comprando para o valor seguir o mercado.</p>}
        </div>
      </div>
      <p className="muted small disclaimer">
        Informação educativa, não é aconselhamento financeiro personalizado. Antes de investir, confirma o documento de informação
        fundamental (KID) do ETF e os custos da tua corretora.
      </p>
    </Card>
  );
}
