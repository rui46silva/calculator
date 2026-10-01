export interface PricePoint {
  /** Epoch ms of the period (month) start. */
  t: number;
  /** Close adjusted for dividends and splits when the source provides it. */
  close: number;
}

export interface PriceSeries {
  symbol: string;
  name: string;
  currency: string;
  /** Latest traded price. */
  price: number;
  /** Epoch ms of the latest price. */
  asOf: number;
  /** Monthly history, oldest first. */
  points: PricePoint[];
  source: 'yahoo' | 'stooq';
}

export interface EtfPreset {
  symbol: string;
  name: string;
  group: string;
}

/** Xetra listings trade in EUR, which avoids FX noise for a Portuguese investor. */
export const ETF_PRESETS: EtfPreset[] = [
  { symbol: 'SXR8.DE', name: 'iShares Core S&P 500 (Acc)', group: 'S&P 500' },
  { symbol: 'VUAA.DE', name: 'Vanguard S&P 500 (Acc)', group: 'S&P 500' },
  { symbol: 'SPY', name: 'SPDR S&P 500 (USD)', group: 'S&P 500' },
  { symbol: 'VWCE.DE', name: 'Vanguard FTSE All-World (Acc)', group: 'Mundo' },
  { symbol: 'EUNL.DE', name: 'iShares Core MSCI World (Acc)', group: 'Mundo' },
  { symbol: 'SXRV.DE', name: 'iShares Nasdaq 100 (Acc)', group: 'Tecnologia' },
  { symbol: 'IS3N.DE', name: 'iShares Core MSCI EM IMI (Acc)', group: 'Emergentes' },
];

export const SYMBOL_PATTERN = /^[A-Za-z0-9^][A-Za-z0-9.\-=^]{0,19}$/;
