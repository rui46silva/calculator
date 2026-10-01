export interface LoanTerms {
  principal: number;
  /** Nominal annual rate (TAN), e.g. 0.035 for 3.5%. */
  annualRate: number;
  months: number;
}

export interface ExtraPayment {
  /** 1-based month in which the extra payment is made (after that month's instalment). */
  month: number;
  amount: number;
  /** 'term' keeps the instalment and shortens the loan; 'payment' keeps the term and lowers the instalment. */
  mode: 'term' | 'payment';
  /** Early-repayment fee as a fraction of the amount, e.g. 0.005 for 0.5%. */
  feeRate?: number;
}

export interface ScheduleRow {
  month: number;
  payment: number;
  interest: number;
  principal: number;
  extra: number;
  balance: number;
}

export interface Schedule {
  rows: ScheduleRow[];
  totalInterest: number;
  totalPaid: number;
  totalFees: number;
}

/** Fixed instalment for an annuity (French amortization system). */
export function monthlyPayment(principal: number, annualRate: number, months: number): number {
  if (months <= 0 || principal <= 0) return 0;
  const r = annualRate / 12;
  if (r === 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}

export function amortizationSchedule(terms: LoanTerms, extras: ExtraPayment[] = []): Schedule {
  const r = terms.annualRate / 12;
  let balance = terms.principal;
  let payment = monthlyPayment(terms.principal, terms.annualRate, terms.months);
  const rows: ScheduleRow[] = [];
  let totalInterest = 0;
  let totalPaid = 0;
  let totalFees = 0;

  for (let month = 1; month <= terms.months && balance > 0.005; month++) {
    const interest = balance * r;
    const principalPart = Math.min(payment - interest, balance);
    balance -= principalPart;
    const paid = principalPart + interest;

    let extra = 0;
    for (const e of extras.filter((x) => x.month === month)) {
      const amount = Math.min(e.amount, balance);
      if (amount <= 0) continue;
      balance -= amount;
      extra += amount;
      totalFees += amount * (e.feeRate ?? 0);
      if (e.mode === 'payment' && balance > 0) {
        payment = monthlyPayment(balance, terms.annualRate, terms.months - month);
      }
    }

    totalInterest += interest;
    totalPaid += paid + extra;
    rows.push({ month, payment: paid, interest, principal: principalPart, extra, balance: Math.max(balance, 0) });
  }

  return { rows, totalInterest, totalPaid: totalPaid + totalFees, totalFees };
}

/** Effort rate: share of net monthly income going to debt instalments. */
export function effortRate(monthlyDebt: number, monthlyNetIncome: number): number {
  return monthlyNetIncome > 0 ? monthlyDebt / monthlyNetIncome : 0;
}
