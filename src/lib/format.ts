const eur = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' });
const pct = new Intl.NumberFormat('pt-PT', { style: 'percent', maximumFractionDigits: 1 });

export const money = (n: number) => eur.format(Number.isFinite(n) ? n : 0);
export const percent = (n: number) => pct.format(Number.isFinite(n) ? n : 0);

export function date(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-PT');
}
