/** One movement read from a bank statement, before the user reviews it. */
export interface ImportRow {
  date: string;
  description: string;
  amount: number;
  type: 'expense' | 'income';
  category: string;
  /** What the movement looks like: a one-off purchase, a fixed bill, a subscription or a transfer between own accounts. */
  kind: 'one-off' | 'fixed' | 'subscription' | 'transfer';
}

export interface ImportResult {
  rows: ImportRow[];
  source: 'ai' | 'csv';
  warnings: string[];
}
