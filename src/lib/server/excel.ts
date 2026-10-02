import ExcelJS from 'exceljs';
import type { AppData } from '@/data/types';
import { FREQUENCY_LABELS, toMonthly } from '@/lib/finance/frequency';
import { goalPlan } from '@/lib/finance/goals';
import { loanStatus, monthlySummary } from '@/lib/summary';

const EUR = '#,##0.00 "€"';
const PCT = '0.0%';

type Col = { header: string; key: string; width?: number; fmt?: string };

function sheet(wb: ExcelJS.Workbook, name: string, cols: Col[], rows: Record<string, unknown>[]) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = cols.map((c) => ({ header: c.header, key: c.key, width: c.width ?? Math.max(12, c.header.length + 2) }));
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
  rows.forEach((r) => ws.addRow(r));
  cols.forEach((c, i) => {
    if (c.fmt) ws.getColumn(i + 1).numFmt = c.fmt;
  });
  if (rows.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  return ws;
}

const asDate = (iso: string) => (iso ? new Date(`${iso}T00:00:00Z`) : null);

/** Every part of the user's data as an Excel workbook (one sheet per area). */
export async function buildWorkbook(data: AppData, owner: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Finanças Pessoais';
  wb.created = new Date();
  const s = monthlySummary(data);

  sheet(wb, 'Resumo', [{ header: 'Indicador', key: 'k', width: 34 }, { header: 'Valor', key: 'v', width: 18, fmt: EUR }], [
    { k: `Titular`, v: owner },
    { k: 'Exportado em', v: new Date().toLocaleDateString('pt-PT') },
    { k: 'Rendimento mensal', v: s.income },
    { k: 'Despesas fixas (mensal)', v: s.expenses },
    { k: 'Subscrições (mensal)', v: s.subscriptions },
    { k: 'Prestações (mensal)', v: s.debt },
    { k: 'Gastos pontuais (média 3 meses)', v: s.oneOff },
    { k: 'Saldo mensal', v: s.balance },
    { k: 'Investimentos', v: s.portfolioValue },
    { k: 'Bens', v: s.assets },
    { k: 'Dívidas', v: s.debtBalance },
    { k: 'Património líquido', v: s.netWorth },
  ]);
  sheet(wb, 'Rendimentos', [{ header: 'Nome', key: 'name', width: 28 }, { header: 'Valor', key: 'amount', fmt: EUR }, { header: 'Frequência', key: 'freq' }, { header: 'Mensal', key: 'monthly', fmt: EUR }],
    data.incomes.map((i) => ({ name: i.name, amount: i.amount, freq: FREQUENCY_LABELS[i.frequency], monthly: toMonthly(i.amount, i.frequency) })));
  sheet(wb, 'Despesas fixas', [{ header: 'Nome', key: 'name', width: 28 }, { header: 'Categoria', key: 'cat', width: 16 }, { header: 'Valor', key: 'amount', fmt: EUR }, { header: 'Frequência', key: 'freq' }, { header: 'Mensal', key: 'monthly', fmt: EUR }, { header: 'Próximo pagamento', key: 'due', width: 18, fmt: 'dd/mm/yyyy' }],
    data.expenses.map((e) => ({ name: e.name, cat: e.category, amount: e.amount, freq: FREQUENCY_LABELS[e.frequency], monthly: toMonthly(e.amount, e.frequency), due: e.dueDate ? asDate(e.dueDate) : null })));
  sheet(wb, 'Subscrições', [{ header: 'Nome', key: 'name', width: 24 }, { header: 'Categoria', key: 'cat', width: 16 }, { header: 'Valor', key: 'amount', fmt: EUR }, { header: 'Frequência', key: 'freq' }, { header: 'Anual', key: 'annual', fmt: EUR }, { header: 'Renovação', key: 'next', width: 14, fmt: 'dd/mm/yyyy' }, { header: 'Pouco usada', key: 'rare' }],
    data.subscriptions.map((x) => ({ name: x.name, cat: x.category, amount: x.amount, freq: FREQUENCY_LABELS[x.frequency], annual: toMonthly(x.amount, x.frequency) * 12, next: asDate(x.nextRenewal), rare: x.rarelyUsed ? 'Sim' : '' })));
  sheet(wb, 'Créditos', [{ header: 'Nome', key: 'name', width: 24 }, { header: 'Tipo', key: 'type' }, { header: 'Montante', key: 'principal', fmt: EUR }, { header: 'TAN', key: 'rate', fmt: '0.00%' }, { header: 'Prazo (meses)', key: 'months' }, { header: 'Início', key: 'start', fmt: 'dd/mm/yyyy' }, { header: 'Prestação', key: 'payment', fmt: EUR }, { header: 'Em dívida', key: 'balance', fmt: EUR }, { header: 'Meses restantes', key: 'left' }],
    data.loans.map((l) => {
      const st = loanStatus(l);
      return { name: l.name, type: l.type, principal: l.principal, rate: l.annualRate, months: l.months, start: asDate(l.startDate), payment: st.payment, balance: st.balance, left: st.remainingMonths };
    }));
  sheet(wb, 'Movimentos', [{ header: 'Data', key: 'date', width: 12, fmt: 'dd/mm/yyyy' }, { header: 'Descrição', key: 'desc', width: 34 }, { header: 'Categoria', key: 'cat', width: 16 }, { header: 'Tipo', key: 'type' }, { header: 'Valor', key: 'amount', fmt: EUR }, { header: 'Origem', key: 'source' }, { header: 'Nota', key: 'note', width: 24 }],
    [...(data.transactions ?? [])].sort((a, b) => b.date.localeCompare(a.date)).map((t) => ({ date: asDate(t.date), desc: t.description, cat: t.category, type: t.type === 'income' ? 'Entrada' : 'Despesa', amount: t.type === 'income' ? t.amount : -t.amount, source: t.source === 'import' ? 'Importado' : 'Manual', note: t.note ?? '' })));
  sheet(wb, 'Investimentos', [{ header: 'Nome', key: 'name', width: 26 }, { header: 'Tipo', key: 'cls' }, { header: 'Ticker', key: 'ticker' }, { header: 'Unidades', key: 'units' }, { header: 'Investido', key: 'invested', fmt: EUR }, { header: 'Valor atual', key: 'value', fmt: EUR }, { header: 'Ganho', key: 'gain', fmt: EUR }, { header: 'Contribuição mensal', key: 'monthly', fmt: EUR }],
    data.investments.map((i) => ({ name: i.name, cls: i.assetClass, ticker: i.ticker ?? '', units: i.units ?? '', invested: i.invested, value: i.currentValue, gain: i.currentValue - i.invested, monthly: i.monthlyContribution })));
  const lots = data.investments.flatMap((i) => (i.lots ?? []).map((l) => ({ inv: i.name, date: asDate(l.date), units: l.units, price: l.price, fees: l.fees, total: l.units * l.price + (l.fees || 0) })));
  if (lots.length) sheet(wb, 'Compras', [{ header: 'Investimento', key: 'inv', width: 24 }, { header: 'Data', key: 'date', fmt: 'dd/mm/yyyy' }, { header: 'Unidades', key: 'units' }, { header: 'Preço', key: 'price', fmt: EUR }, { header: 'Comissão', key: 'fees', fmt: EUR }, { header: 'Total', key: 'total', fmt: EUR }], lots);
  sheet(wb, 'Metas', [{ header: 'Meta', key: 'name', width: 26 }, { header: 'Objetivo', key: 'target', fmt: EUR }, { header: 'Poupado', key: 'saved', fmt: EUR }, { header: 'Progresso', key: 'progress', fmt: PCT }, { header: 'Data', key: 'date', fmt: 'dd/mm/yyyy' }, { header: 'Por mês', key: 'monthly', fmt: EUR }],
    (data.goals ?? []).map((g) => {
      const p = goalPlan(g);
      return { name: g.name, target: g.target, saved: g.saved, progress: p.progress, date: asDate(g.targetDate), monthly: p.monthly };
    }));
  sheet(wb, 'Bens', [{ header: 'Nome', key: 'name', width: 26 }, { header: 'Tipo', key: 'type', width: 18 }, { header: 'Valor', key: 'value', fmt: EUR }], (data.assets ?? []).map((a) => ({ name: a.name, type: a.type, value: a.value })));
  sheet(wb, 'Histórico', [{ header: 'Mês', key: 'month' }, { header: 'Rendimento', key: 'income', fmt: EUR }, { header: 'Saídas', key: 'outgoing', fmt: EUR }, { header: 'Poupança', key: 'savings', fmt: EUR }, { header: 'Investimentos', key: 'investments', fmt: EUR }, { header: 'Bens', key: 'assets', fmt: EUR }, { header: 'Dívidas', key: 'debt', fmt: EUR }, { header: 'Património', key: 'netWorth', fmt: EUR }],
    (data.snapshots ?? []).map((x) => ({ ...x })));

  return Buffer.from(await wb.xlsx.writeBuffer());
}
