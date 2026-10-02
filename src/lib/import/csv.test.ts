import { describe, expect, it } from 'vitest';
import { parseAmount, parseDate, parseStatementCsv } from './csv';

describe('parsers', () => {
  it('reads Portuguese and international amounts', () => {
    expect(parseAmount('1.234,56')).toBe(1234.56);
    expect(parseAmount('-12,30 €')).toBe(-12.3);
    expect(parseAmount('1,234.56')).toBe(1234.56);
    expect(parseAmount('(45,00)')).toBe(-45);
    expect(parseAmount('')).toBeNull();
  });

  it('reads common date formats', () => {
    expect(parseDate('05-10-2026')).toBe('2026-10-05');
    expect(parseDate('5/9/26')).toBe('2026-09-05');
    expect(parseDate('2026-10-05')).toBe('2026-10-05');
    expect(parseDate('ontem')).toBeNull();
  });
});

describe('parseStatementCsv', () => {
  it('handles a single signed amount column with preamble lines', () => {
    const csv = [
      'Conta;PT50 0000',
      'Período;01-09-2026 a 30-09-2026',
      '',
      'Data mov.;Data valor;Descrição;Montante;Saldo',
      '02-09-2026;02-09-2026;COMPRA PINGO DOCE LISBOA;-45,20;1.954,80',
      '03-09-2026;03-09-2026;TRF SALARIO EMPRESA X;2.000,00;3.954,80',
      '05-09-2026;05-09-2026;"JANTAR RESTAURANTE ""O PATIO""";-62,00;3.892,80',
    ].join('\n');
    const rows = parseStatementCsv(csv);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ date: '2026-09-02', amount: 45.2, type: 'expense', category: 'Supermercado', kind: 'one-off' });
    expect(rows[1]).toMatchObject({ type: 'income', amount: 2000, kind: 'transfer' });
    expect(rows[2]).toMatchObject({ description: 'JANTAR RESTAURANTE "O PATIO"', category: 'Restauração' });
  });

  it('handles separate debit/credit columns and comma separators', () => {
    const csv = 'Date,Description,Debit,Credit\n2026-09-10,Uber trip,12.50,\n2026-09-11,Refund,,30.00\n';
    const rows = parseStatementCsv(csv);
    expect(rows.map((r) => [r.type, r.amount, r.category])).toEqual([
      ['expense', 12.5, 'Transportes'],
      ['income', 30, 'Outros'],
    ]);
  });

  it('returns nothing when no header is recognised', () => {
    expect(parseStatementCsv('a;b;c\n1;2;3')).toEqual([]);
  });
});
