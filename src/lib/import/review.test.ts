import { describe, expect, it } from 'vitest';
import type { Transaction } from '../../data/types';
import { prepareReview } from './review';

const row = (date: string, amount: number, description: string, kind: 'one-off' | 'transfer' = 'one-off') => ({
  date,
  description,
  amount,
  type: 'expense' as const,
  category: 'Outros',
  kind,
  fileName: 'set.csv',
});

describe('prepareReview', () => {
  it('unticks duplicates (existing or repeated in the batch) and transfers', () => {
    const existing: Transaction[] = [
      { id: 't', date: '2026-09-02', description: 'Pingo Doce', amount: 45.2, type: 'expense', category: 'Supermercado', source: 'manual' },
    ];
    const r = prepareReview(
      [row('2026-09-02', 45.2, 'COMPRA PINGO DOCE'), row('2026-09-03', 12, 'Uber'), row('2026-09-03', 12, 'Uber'), row('2026-09-04', 500, 'TRF poupança', 'transfer')],
      existing,
    );
    expect(r.map((x) => [x.duplicate, x.include])).toEqual([
      [true, false],
      [false, true],
      [true, false],
      [false, false],
    ]);
  });
});
