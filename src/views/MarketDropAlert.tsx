'use client';

import Link from 'next/link';
import { drawdown } from '../lib/finance/portfolio';
import { useMarket } from '../lib/useMarket';
import { percent } from '../lib/format';

const SYMBOL = 'SXR8.DE';

/** Reminds the user of the plan when the S&P 500 is 10%+ below its high. Hidden otherwise. */
export function MarketDropAlert() {
  const { data } = useMarket(SYMBOL);
  if (!data) return null;
  const d = drawdown(data.points, data.price);
  if (d.level === 'none') return null;
  return (
    <ul className="advice alerts">
      <li className={d.level === 'bear' ? 'advice-bad' : 'advice-warn'}>
        <span aria-hidden>↓</span>
        <span>
          <strong>
            S&P 500 {percent(Math.abs(d.fromHigh))} abaixo do máximo ({d.level === 'bear' ? 'mercado em baixa' : 'correção'}).
          </strong>{' '}
          Faz parte do caminho: quedas destas acontecem a cada poucos anos. Mantém o investimento mensal — estás a comprar mais barato — e
          não vendas por impulso. <Link href="/plano">Ver a estratégia</Link>
        </span>
      </li>
    </ul>
  );
}
