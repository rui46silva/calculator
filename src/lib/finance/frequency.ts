export type Frequency = 'weekly' | 'monthly' | 'quarterly' | 'semiannual' | 'annual';

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  weekly: 'Semanal',
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual',
};

const PER_YEAR: Record<Frequency, number> = {
  weekly: 52,
  monthly: 12,
  quarterly: 4,
  semiannual: 2,
  annual: 1,
};

/** Converts an amount charged at `frequency` into its monthly equivalent. */
export function toMonthly(amount: number, frequency: Frequency): number {
  return (amount * PER_YEAR[frequency]) / 12;
}

export function toAnnual(amount: number, frequency: Frequency): number {
  return amount * PER_YEAR[frequency];
}
