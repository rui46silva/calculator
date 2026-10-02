import { emptyData, type AppData } from './types';

/** Arrays of records merged item by item, keyed by `id` (snapshots by `month`). */
const KEYED: Partial<Record<keyof AppData, string>> = {
  incomes: 'id',
  expenses: 'id',
  loans: 'id',
  subscriptions: 'id',
  investments: 'id',
  transactions: 'id',
  goals: 'id',
  assets: 'id',
  imports: 'id',
  settlements: 'id',
  snapshots: 'month',
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function mergeKeyed<T extends Record<string, unknown>>(base: T[] = [], local: T[] = [], remote: T[] = [], key: string): T[] {
  const index = (list: T[]) => new Map(list.map((x) => [String(x[key]), x]));
  const b = index(base);
  const l = index(local);
  const r = index(remote);
  const out: T[] = [];
  // Keep the order of the remote list, then append items only the local side has.
  const ids = [...r.keys(), ...[...l.keys()].filter((id) => !r.has(id))];
  for (const id of ids) {
    const inB = b.get(id);
    const inL = l.get(id);
    const inR = r.get(id);
    if (inL && inR) {
      // Both have it: take whichever side changed it (local wins if both did).
      out.push(inB && same(inL, inB) ? inR : inL);
    } else if (inL) {
      // Missing remotely: new locally (keep) or deleted remotely (drop, unless edited locally since).
      if (!inB || !same(inL, inB)) out.push(inL);
    } else if (inR) {
      // Missing locally: new remotely (keep) or deleted locally (drop, unless edited remotely since).
      if (!inB || !same(inR, inB)) out.push(inR);
    }
  }
  return out;
}

/**
 * Three-way merge of two edited copies of the same document, given the version both started from.
 * Lists are merged per item so concurrent additions from two devices or two people are all kept;
 * other fields take the side that changed them (local when both did).
 */
export function mergeData(base: AppData | null, local: AppData, remote: AppData): AppData {
  const b = { ...emptyData(), ...(base ?? {}) } as AppData;
  const out: Record<string, unknown> = { ...remote };
  const keys = new Set([...Object.keys(local), ...Object.keys(remote)]) as Set<keyof AppData>;
  for (const k of keys) {
    if (k === 'updatedAt' || k === 'version') continue;
    const key = KEYED[k];
    if (key) {
      out[k] = mergeKeyed(b[k] as never, local[k] as never, remote[k] as never, key);
    } else if (k === 'dismissedRecurring') {
      out[k] = [...new Set([...(remote.dismissedRecurring ?? []), ...(local.dismissedRecurring ?? [])])];
    } else {
      out[k] = !same(local[k], b[k]) ? local[k] : remote[k];
    }
  }
  return { ...(out as unknown as AppData), version: 1, updatedAt: Math.max(Date.now(), remote.updatedAt + 1) };
}
