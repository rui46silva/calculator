'use client';

import { useState, type FormEvent } from 'react';
import { reloadFresh, useStore } from '../data/store';
import { Card, Field } from '../components/ui';

async function call(body: unknown) {
  const res = await fetch('/api/household', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => ({}))) as { error?: string; code?: string; expiresAt?: string };
  if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`);
  return json;
}

/** Shared account: create, invite with a code, join, see members, leave. */
export function Sharing() {
  const { user, household, refreshHousehold } = useStore();
  const [name, setName] = useState('Casa');
  const [code, setCode] = useState('');
  const [invite, setInvite] = useState<{ code: string; expiresAt: string } | null>(null);
  const [keepCopy, setKeepCopy] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const me = household?.members.find((m) => m.userId === user.id);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Switching between personal and shared data: start again from the server's copy.
  const switched = () => reloadFresh(user.id);

  if (!household) {
    return (
      <Card title="Conta partilhada">
        <p className="muted small">
          Partilha o orçamento com outra pessoa: os dois veem e editam os mesmos dados, e em Movimentos podem dividir despesas e acertar
          contas. Os teus dados pessoais ficam guardados à parte.
        </p>
        <div className="grid-2 sharing-options">
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void run(async () => {
                await call({ action: 'create', name });
                switched();
              });
            }}
          >
            <h3>Criar</h3>
            <p className="muted small">Começa com uma cópia dos teus dados atuais.</p>
            <Field label="Nome">
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
            </Field>
            <button type="submit" className="primary" disabled={busy}>
              Criar conta partilhada
            </button>
          </form>
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void run(async () => {
                await call({ action: 'join', code });
                switched();
              });
            }}
          >
            <h3>Entrar com convite</h3>
            <p className="muted small">Passas a ver os dados partilhados em vez dos teus.</p>
            <Field label="Código de convite">
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ex.: K7PQ2MXA" autoCapitalize="characters" required />
            </Field>
            <button type="submit" className="ghost" disabled={busy || code.trim().length < 6}>
              Entrar
            </button>
          </form>
        </div>
        {error && (
          <p className="form-msg bad" role="alert">
            {error}
          </p>
        )}
      </Card>
    );
  }

  return (
    <Card title={`Conta partilhada: ${household.name}`}>
      <ul className="list members">
        {household.members.map((m) => (
          <li key={m.userId}>
            <span>
              {m.name || m.email}
              {m.userId === user.id && <span className="muted small"> (tu)</span>}
            </span>
            <span className="muted">{m.role === 'owner' ? 'Criador' : 'Membro'}</span>
            {me?.role === 'owner' && m.userId !== user.id ? (
              <button
                className="link"
                onClick={() =>
                  window.confirm(`Remover ${m.name || m.email} da conta partilhada?`) &&
                  void run(async () => {
                    await call({ action: 'remove', userId: m.userId });
                    await refreshHousehold();
                  })
                }
              >
                Remover
              </button>
            ) : (
              <span />
            )}
          </li>
        ))}
      </ul>

      <div className="invite">
        {invite ? (
          <>
            <p className="small">Partilha este código (válido até {new Date(invite.expiresAt).toLocaleDateString('pt-PT')}, uso único):</p>
            <div className="invite-code" aria-label="Código de convite">
              {invite.code}
            </div>
            <button className="ghost small-btn" onClick={() => void navigator.clipboard?.writeText(invite.code)}>
              Copiar código
            </button>
          </>
        ) : (
          <button className="primary" disabled={busy} onClick={() => void run(async () => setInvite((await call({ action: 'invite' })) as { code: string; expiresAt: string }))}>
            Convidar alguém
          </button>
        )}
      </div>

      <details className="table-details leave">
        <summary>Sair da conta partilhada</summary>
        <label className="check">
          <input type="checkbox" checked={keepCopy} onChange={(e) => setKeepCopy(e.target.checked)} />
          Levar uma cópia dos dados partilhados para a minha conta pessoal
        </label>
        <p className="muted small">Sem a cópia, voltas aos teus dados pessoais de antes de partilhar.</p>
        <button
          className="danger"
          disabled={busy}
          onClick={() =>
            window.confirm('Sair da conta partilhada?') &&
            void run(async () => {
              await call({ action: 'leave', keepCopy });
              switched();
            })
          }
        >
          Sair
        </button>
      </details>
      {error && (
        <p className="form-msg bad" role="alert">
          {error}
        </p>
      )}
    </Card>
  );
}
