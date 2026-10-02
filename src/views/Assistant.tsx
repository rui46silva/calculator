'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useStore } from '../data/store';
import { Card, Stat } from '../components/ui';
import { RichText } from '../components/RichText';
import { monthReport } from '../lib/report';
import { monthKey, shiftMonth } from '../lib/finance/transactions';
import { money, percent } from '../lib/format';
import { AI_ENABLED } from '../lib/features';

const SUGGESTIONS = [
  'Quanto gastei em restaurantes este ano?',
  'Posso comprar um carro de 15 000 € em 2027?',
  'Onde consigo poupar 100 € por mês?',
  'Como estão as minhas metas?',
];

const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  const s = new Date(y, m - 1, 1).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

async function ask(body: unknown): Promise<string> {
  const res = await fetch('/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => ({}))) as { answer?: string; error?: string };
  if (!res.ok || !json.answer) throw new Error(json.error ?? `Erro ${res.status}`);
  return json.answer;
}

export function Assistant() {
  const { data } = useStore();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [comment, setComment] = useState<{ month: string; text: string } | null>(null);
  const [commentBusy, setCommentBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const report = monthReport(data, month);
  const isCurrent = month === monthKey(new Date());

  useEffect(() => {
    if (!AI_ENABLED) return setConfigured(false);
    fetch('/api/assistant')
      .then((r) => r.json())
      .then((j: { configured?: boolean }) => setConfigured(!!j.configured))
      .catch(() => setConfigured(false));
  }, []);

  useEffect(() => endRef.current?.scrollIntoView({ block: 'nearest' }), [messages, busy]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    const next = [...messages, { role: 'user' as const, content: q }];
    setMessages(next);
    setInput('');
    setBusy(true);
    setError(null);
    try {
      setMessages([...next, { role: 'assistant', content: await ask({ messages: next }) }]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const generateComment = async () => {
    setCommentBusy(true);
    setError(null);
    try {
      setComment({ month, text: await ask({ mode: 'report', month }) });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCommentBusy(false);
    }
  };

  return (
    <>
      <h1>Assistente</h1>

      <Card
        title="Resumo do mês"
        actions={
          <Link href={`/relatorio?mes=${month}`} className="small">
            Versão para imprimir / PDF
          </Link>
        }
      >
        <div className="month-nav">
          <button className="ghost" aria-label="Mês anterior" onClick={() => setMonth(shiftMonth(month, -1))}>
            ‹
          </button>
          <strong>{monthLabel(month)}</strong>
          <button className="ghost" aria-label="Mês seguinte" onClick={() => setMonth(shiftMonth(month, 1))} disabled={isCurrent}>
            ›
          </button>
          {report.inProgress && <span className="tag">mês em curso</span>}
        </div>
        <div className="stats">
          <Stat label="Rendimento" value={money(report.income)} />
          <Stat label="Despesas fixas" value={money(report.fixed)} />
          <Stat label="Gastos pontuais" value={money(report.oneOff)} hint={report.topCategories.map(([c]) => c).join(', ') || undefined} />
          <Stat label="Poupança" value={`${money(report.saved)} (${percent(report.savingsRate)})`} tone={report.savingsRate >= 0.2 ? 'good' : report.saved < 0 ? 'bad' : undefined} />
        </div>
        <div className="report-lists">
          {report.good.length > 0 && (
            <section>
              <h3>Correu bem</h3>
              <ul className="advice">
                {report.good.map((t) => (
                  <li key={t} className="advice-good">
                    <span aria-hidden>✓</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {report.watch.length > 0 && (
            <section>
              <h3>A ter atenção</h3>
              <ul className="advice">
                {report.watch.map((t) => (
                  <li key={t} className="advice-warn">
                    <span aria-hidden>!</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {report.tips.length > 0 && (
            <section>
              <h3>Sugestões</h3>
              <ul className="advice">
                {report.tips.map((t) => (
                  <li key={t} className="advice-info">
                    <span aria-hidden>i</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        {configured && (
          <div className="ai-comment">
            {comment?.month === month ? (
              <>
                <h3>Comentário da IA</h3>
                <RichText text={comment.text} />
              </>
            ) : (
              <button className="ghost" onClick={generateComment} disabled={commentBusy}>
                {commentBusy ? 'A escrever…' : '✨ Pedir comentário da IA a este mês'}
              </button>
            )}
          </div>
        )}
      </Card>

      <Card title="Pergunta sobre as tuas finanças">
        {!AI_ENABLED ? (
          <p className="muted locked-note">
            <span aria-hidden>🔒</span>
            <span>O assistente com IA está bloqueado por agora e vai chegar em breve. O resumo do mês acima funciona sem IA.</span>
          </p>
        ) : configured === false ? (
          <p className="muted">
            O assistente precisa de uma chave da OpenAI. No Vercel, adiciona <code>OPENAI_API_KEY</code> em Settings → Environment
            Variables e faz Redeploy. O resumo do mês acima funciona sem IA.
          </p>
        ) : (
          <>
            <div className="chat" aria-live="polite">
              {messages.length === 0 && (
                <div className="chat-empty">
                  <p className="muted">Pergunta o que quiseres sobre os teus dados. Por exemplo:</p>
                  <div className="chips">
                    {SUGGESTIONS.map((s) => (
                      <button key={s} className="chip" onClick={() => void send(s)} disabled={busy || configured === null}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`bubble ${m.role}`}>
                  {m.role === 'assistant' ? <RichText text={m.content} /> : m.content}
                </div>
              ))}
              {busy && (
                <div className="bubble assistant typing" aria-label="A pensar">
                  <span />
                  <span />
                  <span />
                </div>
              )}
              <div ref={endRef} />
            </div>
            {error && (
              <p className="form-msg bad" role="alert">
                {error}
              </p>
            )}
            <form
              className="chat-input"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                void send(input);
              }}
            >
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Escreve a tua pergunta…" aria-label="Pergunta" maxLength={2000} />
              <button type="submit" className="primary" disabled={busy || !input.trim()}>
                Enviar
              </button>
            </form>
            <p className="muted small">As respostas usam os teus dados da app. Confirma sempre os valores antes de decidir.</p>
          </>
        )}
      </Card>
    </>
  );
}
