export interface GrowthInput {
  initial: number;
  monthlyContribution: number;
  /** Expected annual return, e.g. 0.06 for 6%. */
  annualReturn: number;
  years: number;
  /** Annual inflation used to express values in today's money. */
  inflation?: number;
}

export interface GrowthPoint {
  year: number;
  contributed: number;
  value: number;
  realValue: number;
}

/** Year-by-year projection with monthly compounding and end-of-month contributions. */
export function projectGrowth(input: GrowthInput): GrowthPoint[] {
  const r = Math.pow(1 + input.annualReturn, 1 / 12) - 1;
  const inflation = input.inflation ?? 0;
  let value = input.initial;
  let contributed = input.initial;
  const points: GrowthPoint[] = [{ year: 0, contributed, value, realValue: value }];

  for (let year = 1; year <= input.years; year++) {
    for (let m = 0; m < 12; m++) {
      value = value * (1 + r) + input.monthlyContribution;
      contributed += input.monthlyContribution;
    }
    points.push({ year, contributed, value, realValue: value / Math.pow(1 + inflation, year) });
  }
  return points;
}

/** Portfolio size needed to sustain `annualSpending` with a given safe withdrawal rate (4% rule by default). */
export function financialIndependenceTarget(annualSpending: number, withdrawalRate = 0.04): number {
  return annualSpending / withdrawalRate;
}

/** Portuguese flat tax (taxa liberatória) on capital gains. */
export const PT_CAPITAL_GAINS_TAX = 0.28;
