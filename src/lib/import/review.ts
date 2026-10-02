import type { Transaction } from '../../data/types';
import { normalizeDescription } from '../finance/recurring';
import type { ImportRow } from './types';

export interface ReviewRow extends ImportRow {
  key: string;
  fileName: string;
  include: boolean;
  duplicate: boolean;
}

const sameMoney = (a: number, b: number) => Math.abs(a - b) < 0.005;

/**
 * Marks rows that already exist (same date, amount and direction — or the same row twice in this
 * batch) and transfers, which are left unticked by default.
 */
export function prepareReview(rows: (ImportRow & { fileName: string })[], existing: Transaction[]): ReviewRow[] {
  const seen: ReviewRow[] = [];
  return rows.map((r, i) => {
    const desc = normalizeDescription(r.description);
    const inData = existing.some((t) => t.date === r.date && t.type === r.type && sameMoney(t.amount, r.amount));
    const inBatch = seen.some((s) => s.date === r.date && s.type === r.type && sameMoney(s.amount, r.amount) && normalizeDescription(s.description) === desc);
    const row: ReviewRow = { ...r, key: `${i}`, duplicate: inData || inBatch, include: !(inData || inBatch) && r.kind !== 'transfer' };
    seen.push(row);
    return row;
  });
}
