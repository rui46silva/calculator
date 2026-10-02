import type { Settlement, Transaction } from '../../data/types';

export interface MemberBalance {
  userId: string;
  paid: number;
  share: number;
  /** Positive: others owe this member. Negative: this member owes. */
  balance: number;
}

export interface Transfer {
  from: string;
  to: string;
  amount: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Equal split of shared expenses between members, net of settlements already made.
 * Expenses without a payer are attributed to `fallbackPayer` (whoever was alone before sharing).
 */
export function splitBalances(
  transactions: Transaction[],
  settlements: Settlement[],
  members: string[],
  fallbackPayer: string,
): MemberBalance[] {
  if (members.length < 2) return [];
  const paid = new Map(members.map((m) => [m, 0]));
  let total = 0;
  for (const t of transactions) {
    if (t.type !== 'expense' || t.shared === false) continue;
    const payer = t.paidBy && paid.has(t.paidBy) ? t.paidBy : fallbackPayer;
    if (!paid.has(payer)) continue;
    paid.set(payer, paid.get(payer)! + t.amount);
    total += t.amount;
  }
  const share = total / members.length;
  const balance = new Map(members.map((m) => [m, paid.get(m)! - share]));
  for (const s of settlements) {
    if (balance.has(s.from)) balance.set(s.from, balance.get(s.from)! + s.amount);
    if (balance.has(s.to)) balance.set(s.to, balance.get(s.to)! - s.amount);
  }
  return members.map((m) => ({ userId: m, paid: r2(paid.get(m)!), share: r2(share), balance: r2(balance.get(m)!) }));
}

/** Fewest transfers that settle everyone (greedy: largest debtor pays largest creditor). */
export function settleUp(balances: MemberBalance[]): Transfer[] {
  const debtors = balances.filter((b) => b.balance < -0.005).map((b) => ({ id: b.userId, amt: -b.balance }));
  const creditors = balances.filter((b) => b.balance > 0.005).map((b) => ({ id: b.userId, amt: b.balance }));
  debtors.sort((a, b) => b.amt - a.amt);
  creditors.sort((a, b) => b.amt - a.amt);
  const out: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].amt, creditors[j].amt);
    out.push({ from: debtors[i].id, to: creditors[j].id, amount: r2(amount) });
    debtors[i].amt -= amount;
    creditors[j].amt -= amount;
    if (debtors[i].amt < 0.005) i++;
    if (creditors[j].amt < 0.005) j++;
  }
  return out;
}
