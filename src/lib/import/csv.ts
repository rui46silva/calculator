import { suggestCategory } from '../finance/transactions';
import type { ImportRow } from './types';

/** Parses Portuguese and international number formats: "1.234,56", "-12,30", "1,234.56", "12.30 €". */
export function parseAmount(raw: string): number | null {
  let s = raw.replace(/[€\s ]/g, '').replace(/^\+/, '');
  if (!s) return null;
  const negative = /^-|\(.*\)$|-$/.test(s);
  s = s.replace(/[()\-]/g, '');
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/** Accepts dd-mm-yyyy, dd/mm/yyyy, dd.mm.yyyy, yyyy-mm-dd and 2-digit years. */
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return null;
}

function splitLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === sep && !quoted) {
      out.push(cur.trim());
      cur = '';
    } else cur += c;
  }
  out.push(cur.trim());
  return out;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

const TRANSFER = /transf|trf\b|mb way|mbway|levantamento|deposito|entre contas/i;

/**
 * Reads a bank CSV export without AI: finds the header row, the date, description and
 * amount (or debit/credit) columns, and guesses categories from the description.
 */
export function parseStatementCsv(text: string): ImportRow[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const sep = [';', '\t', ','].map((s) => [s, lines.slice(0, 10).reduce((a, l) => a + l.split(s).length, 0)] as const).sort((a, b) => b[1] - a[1])[0][0];

  let header = -1;
  let cols = { date: -1, desc: -1, amount: -1, debit: -1, credit: -1 };
  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    const cells = splitLine(lines[i], sep).map(norm);
    const find = (re: RegExp) => cells.findIndex((c) => re.test(c));
    const date = find(/^data( (mov|movimento|operacao|lancamento))?|^date/);
    const desc = find(/descri|^movimento$|^detalhe|^description|^concept/);
    const amount = find(/^(montante|valor|importancia|amount|quantia)/);
    const debit = find(/^debito|^debit/);
    const credit = find(/^credito|^credit/);
    if (date >= 0 && desc >= 0 && (amount >= 0 || debit >= 0 || credit >= 0)) {
      header = i;
      cols = { date, desc, amount, debit, credit };
      break;
    }
  }
  if (header < 0) return [];

  const rows: ImportRow[] = [];
  for (const line of lines.slice(header + 1)) {
    const cells = splitLine(line, sep);
    const date = parseDate(cells[cols.date] ?? '');
    const description = (cells[cols.desc] ?? '').replace(/\s+/g, ' ').trim();
    if (!date || !description) continue;
    let value: number | null = null;
    if (cols.amount >= 0) value = parseAmount(cells[cols.amount] ?? '');
    if (value === null || value === 0) {
      const debit = cols.debit >= 0 ? parseAmount(cells[cols.debit] ?? '') : null;
      const credit = cols.credit >= 0 ? parseAmount(cells[cols.credit] ?? '') : null;
      if (debit) value = -Math.abs(debit);
      else if (credit) value = Math.abs(credit);
    }
    if (!value) continue;
    rows.push({
      date,
      description,
      amount: Math.abs(value),
      type: value < 0 ? 'expense' : 'income',
      category: suggestCategory(description) ?? 'Outros',
      kind: TRANSFER.test(description) ? 'transfer' : 'one-off',
    });
  }
  return rows;
}
