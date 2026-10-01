import { useMemo, useState } from 'react';
import { useStore, newId } from '../data/store';
import { LOAN_TYPES, type Loan } from '../data/types';
import { Card, Empty, Field, NumberInput, PercentInput, Select, Stat } from '../components/ui';
import { EditDialog } from '../components/EditDialog';
import { useEditor } from '../components/useEditor';
import { amortizationSchedule, monthlyPayment } from '../lib/finance/loan';
import { loanStatus, monthsElapsed } from '../lib/summary';
import { money, percent } from '../lib/format';

const today = () => new Date().toISOString().slice(0, 10);

export function Loans() {
  const { data } = useStore();
  const editor = useEditor(
    'loans',
    (): Loan => ({ id: newId(), name: '', type: LOAN_TYPES[0], principal: 0, annualRate: 0.035, months: 360, startDate: today() }),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = data.loans.find((l) => l.id === selectedId) ?? data.loans[0];

  return (
    <>
      <h1>Créditos</h1>
      <Card title="Os meus créditos" actions={<button onClick={editor.add}>+ Adicionar</button>}>
        {data.loans.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th className="num">Prestação</th>
                  <th className="num">Em dívida</th>
                  <th className="num">Meses restantes</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.loans.map((l) => {
                  const s = loanStatus(l);
                  return (
                    <tr key={l.id} className={l.id === selected?.id ? 'selected' : ''} onClick={() => setSelectedId(l.id)}>
                      <td>
                        {l.name}
                        <div className="muted small">
                          {l.type} · TAN {percent(l.annualRate)}
                        </div>
                      </td>
                      <td className="num">{money(s.payment)}</td>
                      <td className="num">{money(s.balance)}</td>
                      <td className="num">{s.remainingMonths}</td>
                      <td>
                        <button
                          className="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            editor.edit(l);
                          }}
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Adiciona um crédito para veres o plano e simular amortizações.</Empty>
        )}
      </Card>

      {selected && <LoanSimulator key={selected.id} loan={selected} />}

      <EditDialog
        title={editor.isNew ? 'Novo crédito' : 'Editar crédito'}
        open={editor.open}
        onClose={editor.close}
        onSave={editor.save}
        onDelete={editor.isNew ? undefined : editor.remove}
      >
        {editor.draft && (
          <>
            <Field label="Nome">
              <input required value={editor.draft.name} onChange={(e) => editor.set('name', e.target.value)} />
            </Field>
            <Field label="Tipo">
              <Select value={editor.draft.type} options={LOAN_TYPES} onChange={(v) => editor.set('type', v)} />
            </Field>
            <Field label="Montante inicial (€)">
              <NumberInput value={editor.draft.principal} onChange={(n) => editor.set('principal', n)} min={0} />
            </Field>
            <Field label="TAN (%)">
              <PercentInput value={editor.draft.annualRate} onChange={(n) => editor.set('annualRate', n)} />
            </Field>
            <Field label="Prazo (meses)">
              <NumberInput value={editor.draft.months} onChange={(n) => editor.set('months', Math.round(n))} step="1" min={1} />
            </Field>
            <Field label="Data da 1.ª prestação">
              <input type="date" required value={editor.draft.startDate} onChange={(e) => editor.set('startDate', e.target.value)} />
            </Field>
            <p className="muted small full">
              Prestação estimada: {money(monthlyPayment(editor.draft.principal, editor.draft.annualRate, editor.draft.months))}
            </p>
          </>
        )}
      </EditDialog>
    </>
  );
}

function LoanSimulator({ loan }: { loan: Loan }) {
  const paid = Math.min(monthsElapsed(loan.startDate), loan.months);
  const [extra, setExtra] = useState(5000);
  const [month, setMonth] = useState(Math.max(paid, 1));
  const [feeRate, setFeeRate] = useState(0.005);
  const [rateDelta, setRateDelta] = useState(0.01);
  const [showSchedule, setShowSchedule] = useState(false);

  const base = useMemo(() => amortizationSchedule(loan), [loan]);
  const term = useMemo(() => amortizationSchedule(loan, [{ month, amount: extra, mode: 'term', feeRate }]), [loan, month, extra, feeRate]);
  const payment = useMemo(
    () => amortizationSchedule(loan, [{ month, amount: extra, mode: 'payment', feeRate }]),
    [loan, month, extra, feeRate],
  );

  const balanceNow = paid === 0 ? loan.principal : (base.rows[paid - 1]?.balance ?? 0);
  const remaining = loan.months - paid;
  const currentPayment = monthlyPayment(loan.principal, loan.annualRate, loan.months);
  const shockedPayment = monthlyPayment(balanceNow, loan.annualRate + rateDelta, remaining);

  return (
    <>
      <Card title={`Simulação · ${loan.name}`}>
        <div className="stats">
          <Stat label="Prestação" value={money(currentPayment)} />
          <Stat label="Total de juros" value={money(base.totalInterest)} />
          <Stat label="Total a pagar (MTIC aprox.)" value={money(base.totalPaid)} />
          <Stat label="Pago até agora" value={`${paid} / ${loan.months} meses`} />
        </div>
      </Card>

      <div className="grid-2">
        <Card title="Amortização antecipada">
          <div className="form-grid">
            <Field label="Montante (€)">
              <NumberInput value={extra} onChange={setExtra} min={0} />
            </Field>
            <Field label="No mês n.º">
              <NumberInput value={month} onChange={(n) => setMonth(Math.min(Math.max(1, Math.round(n)), loan.months))} step="1" min={1} />
            </Field>
            <Field label="Comissão (%)">
              <PercentInput value={feeRate} onChange={setFeeRate} />
            </Field>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th />
                  <th className="num">Reduzir prazo</th>
                  <th className="num">Reduzir prestação</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Nova prestação</td>
                  <td className="num">{money(currentPayment)}</td>
                  <td className="num">{money(payment.rows[month]?.payment ?? 0)}</td>
                </tr>
                <tr>
                  <td>Prazo total</td>
                  <td className="num">{term.rows.length} meses</td>
                  <td className="num">{payment.rows.length} meses</td>
                </tr>
                <tr>
                  <td>Juros poupados</td>
                  <td className="num good">{money(base.totalInterest - term.totalInterest)}</td>
                  <td className="num good">{money(base.totalInterest - payment.totalInterest)}</td>
                </tr>
                <tr>
                  <td>Comissão</td>
                  <td className="num">{money(term.totalFees)}</td>
                  <td className="num">{money(payment.totalFees)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Variação da taxa (Euribor)">
          <div className="form-grid">
            <Field label="Variação (p.p.)">
              <PercentInput value={rateDelta} onChange={setRateDelta} />
            </Field>
          </div>
          <p>
            Com TAN de <strong>{percent(loan.annualRate + rateDelta)}</strong> sobre o capital em dívida ({money(balanceNow)}), a
            prestação passaria a <strong>{money(shockedPayment)}</strong> (
            <span className={shockedPayment > currentPayment ? 'bad' : 'good'}>
              {shockedPayment >= currentPayment ? '+' : ''}
              {money(shockedPayment - currentPayment)}/mês
            </span>
            ).
          </p>
        </Card>
      </div>

      <Card
        title="Plano de amortização"
        actions={
          <button className="ghost" onClick={() => setShowSchedule((s) => !s)}>
            {showSchedule ? 'Esconder' : 'Mostrar'}
          </button>
        }
      >
        {showSchedule && (
          <div className="table-wrap tall">
            <table>
              <thead>
                <tr>
                  <th>Mês</th>
                  <th className="num">Prestação</th>
                  <th className="num">Juros</th>
                  <th className="num">Capital</th>
                  <th className="num">Em dívida</th>
                </tr>
              </thead>
              <tbody>
                {base.rows.map((r) => (
                  <tr key={r.month} className={r.month === paid ? 'selected' : ''}>
                    <td>{r.month}</td>
                    <td className="num">{money(r.payment)}</td>
                    <td className="num">{money(r.interest)}</td>
                    <td className="num">{money(r.principal)}</td>
                    <td className="num">{money(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
