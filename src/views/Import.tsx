'use client';

import Link from 'next/link';
import { useRef, useState, type DragEvent } from 'react';
import { useStore, newId } from '../data/store';
import { TRANSACTION_CATEGORIES, type Transaction } from '../data/types';
import { Card, Empty, Select } from '../components/ui';
import { prepareReview, type ReviewRow } from '../lib/import/review';
import type { ImportResult, ImportRow } from '../lib/import/types';
import { date, money } from '../lib/format';

const KIND_LABEL = { 'one-off': 'Pontual', fixed: 'Parece fixa', subscription: 'Parece subscrição', transfer: 'Transferência' } as const;

export function ImportView() {
  const { data, update } = useStore();
  const [rows, setRows] = useState<ReviewRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [done, setDone] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [source, setSource] = useState<ImportResult['source']>('ai');
  const fileRef = useRef<HTMLInputElement>(null);
  const imports = [...(data.imports ?? [])].sort((a, b) => b.at.localeCompare(a.at));

  const read = async (files: File[]) => {
    if (!files.length) return;
    setError(null);
    setDone(null);
    setWarnings([]);
    const collected: (ImportRow & { fileName: string })[] = [];
    const notes: string[] = [];
    let lastSource: ImportResult['source'] = 'ai';
    for (const file of files) {
      setBusy(`A ler ${file.name}…`);
      const body = new FormData();
      body.append('file', file);
      try {
        const res = await fetch('/api/import', { method: 'POST', body });
        const json = (await res.json().catch(() => ({}))) as ImportResult & { error?: string };
        if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`);
        lastSource = json.source;
        collected.push(...json.rows.map((r) => ({ ...r, fileName: file.name })));
        notes.push(...json.warnings.map((w) => `${file.name}: ${w}`));
      } catch (err) {
        notes.push(`${file.name}: ${(err as Error).message}`);
        if (files.length === 1) setError((err as Error).message);
      }
    }
    setBusy(null);
    setSource(lastSource);
    setWarnings(files.length === 1 && error ? [] : notes);
    if (collected.length) setRows(prepareReview(collected, data.transactions ?? []));
    else if (files.length > 1) setError('Nenhum movimento encontrado nos ficheiros.');
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void read([...e.dataTransfer.files]);
  };

  const setRow = (key: string, patch: Partial<ReviewRow>) => setRows((rs) => rs?.map((r) => (r.key === key ? { ...r, ...patch } : r)) ?? null);
  const selected = rows?.filter((r) => r.include) ?? [];

  const confirm = () => {
    if (!rows || !selected.length) return;
    const importId = newId();
    const fileName = [...new Set(selected.map((r) => r.fileName))].join(', ');
    const added: Transaction[] = selected.map((r) => ({
      id: newId(),
      date: r.date,
      description: r.description,
      amount: r.amount,
      type: r.type,
      category: r.category,
      source: 'import',
      importId,
    }));
    update({
      transactions: [...(data.transactions ?? []), ...added],
      imports: [...(data.imports ?? []), { id: importId, fileName, at: new Date().toISOString(), count: added.length, source }],
    });
    setDone(`${added.length} movimentos importados.`);
    setRows(null);
    setWarnings([]);
  };

  const undo = (id: string) => {
    if (!window.confirm('Apagar todos os movimentos desta importação?')) return;
    update({
      transactions: (data.transactions ?? []).filter((t) => t.importId !== id),
      imports: (data.imports ?? []).filter((i) => i.id !== id),
    });
  };

  return (
    <>
      <p className="small">
        <Link href="/movimentos">← Movimentos</Link>
      </p>
      <h1>Importar extrato bancário</h1>
      <p className="muted lead">
        Carrega o extrato do banco em PDF, CSV ou Excel (.xlsx). A IA identifica cada movimento e sugere a categoria; tu revês antes de
        gravar. O ficheiro não é guardado.
      </p>

      {!rows && (
        <Card>
          <div
            className={`dropzone ${dragging ? 'over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            {busy ? (
              <p className="dropzone-busy" role="status">
                <span className="spinner" aria-hidden /> {busy}
              </p>
            ) : (
              <>
                <p>
                  <strong>Arrasta para aqui os ficheiros do extrato</strong>
                </p>
                <p className="muted small">PDF, CSV ou Excel (.xlsx), até 4 MB cada. Podes juntar vários meses de uma vez.</p>
                <button className="primary" onClick={() => fileRef.current?.click()}>
                  Escolher ficheiros
                </button>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              multiple
              hidden
              accept=".pdf,.csv,.txt,.xlsx,application/pdf,text/csv"
              onChange={(e) => {
                void read([...(e.target.files ?? [])]);
                e.target.value = '';
              }}
            />
          </div>
          {error && (
            <p className="form-msg bad" role="alert">
              {error}
            </p>
          )}
          {done && (
            <p className="form-msg good" role="status">
              ✓ {done} <Link href="/movimentos">Ver em Movimentos</Link>
            </p>
          )}
        </Card>
      )}

      {rows && (
        <Card
          title={`Revê ${rows.length} movimentos`}
          actions={
            <span className="review-actions">
              <button className="ghost" onClick={() => setRows(rows.map((r) => ({ ...r, include: true })))}>
                Todos
              </button>
              <button className="ghost" onClick={() => setRows(rows.map((r) => ({ ...r, include: false })))}>
                Nenhum
              </button>
            </span>
          }
        >
          {warnings.length > 0 && (
            <ul className="advice">
              {warnings.map((w) => (
                <li key={w} className="advice-warn">
                  <span aria-hidden>!</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="muted small">
            {source === 'ai' ? 'Lido pela IA.' : 'Lido sem IA.'} Movimentos repetidos e transferências entre contas ficam desmarcados.
            Corrige a descrição ou a categoria se for preciso.
          </p>
          <div className="table-wrap tall">
            <table className="review">
              <thead>
                <tr>
                  <th>
                    <span className="sr-only">Importar</span>
                  </th>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th className="num">Valor</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className={r.include ? '' : 'excluded'}>
                    <td>
                      <input type="checkbox" aria-label={`Importar ${r.description}`} checked={r.include} onChange={(e) => setRow(r.key, { include: e.target.checked })} />
                    </td>
                    <td className="nowrap">{date(r.date)}</td>
                    <td>
                      <input value={r.description} onChange={(e) => setRow(r.key, { description: e.target.value })} aria-label="Descrição" />
                      <div className="show-mobile review-mobile-cat">
                        <Select value={r.category} options={TRANSACTION_CATEGORIES} onChange={(v) => setRow(r.key, { category: v })} />
                      </div>
                      <div className="review-tags">
                        {r.duplicate && <span className="tag tag-warn">Já existe</span>}
                        {r.kind !== 'one-off' && <span className="tag">{KIND_LABEL[r.kind]}</span>}
                      </div>
                    </td>
                    <td>
                      <Select value={r.category} options={TRANSACTION_CATEGORIES} onChange={(v) => setRow(r.key, { category: v })} />
                    </td>
                    <td className={`num ${r.type === 'income' ? 'good' : ''}`}>
                      {r.type === 'income' ? '+' : '−'}
                      {money(r.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="review-footer">
            <span className="muted small">
              {selected.length} selecionados · despesas {money(selected.filter((r) => r.type === 'expense').reduce((a, r) => a + r.amount, 0))}
            </span>
            <span className="spacer" />
            <button className="ghost" onClick={() => setRows(null)}>
              Cancelar
            </button>
            <button className="primary" onClick={confirm} disabled={!selected.length}>
              Importar {selected.length} movimentos
            </button>
          </div>
        </Card>
      )}

      <Card title="Importações anteriores">
        {imports.length ? (
          <ul className="list">
            {imports.map((i) => (
              <li key={i.id}>
                <span>
                  {i.fileName}
                  <span className="muted small"> · {i.source === 'ai' ? 'IA' : 'CSV'}</span>
                </span>
                <span className="muted">
                  {new Date(i.at).toLocaleDateString('pt-PT')} · {i.count} movimentos
                </span>
                <button className="link" onClick={() => undo(i.id)}>
                  Anular
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Ainda não importaste nenhum extrato.</Empty>
        )}
      </Card>
    </>
  );
}
