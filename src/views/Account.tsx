'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '../data/store';
import type { AppData } from '../data/types';
import { authClient } from '../lib/auth-client';
import { date } from '../lib/format';
import { Card, Field } from '../components/ui';
import { initials } from '../components/Layout';
import { Sharing } from './Sharing';
import { NotificationsCard } from './NotificationsCard';

export function Account() {
  const { data, user, syncStatus, replaceAll } = useStore();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user.name ?? '');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await authClient.updateUser({ name: name.trim() });
      if (res?.error) throw res.error;
      setMessage({ ok: true, text: 'Perfil atualizado.' });
    } catch (err) {
      setMessage({ ok: false, text: (err as Error)?.message || 'Não foi possível atualizar o perfil.' });
    } finally {
      setSaving(false);
    }
  };

  const signOut = async () => {
    try {
      await authClient.signOut();
    } finally {
      router.replace('/login');
    }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `financas-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJson = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as AppData;
      if (parsed.version !== 1) throw new Error('formato desconhecido');
      if (confirm('Substituir todos os dados atuais pelos do ficheiro?')) replaceAll(parsed);
    } catch (err) {
      alert(`Não foi possível importar: ${(err as Error).message}`);
    }
  };

  const counts = [
    ['Rendimentos', data.incomes.length],
    ['Despesas', data.expenses.length],
    ['Créditos', data.loans.length],
    ['Subscrições', data.subscriptions.length],
    ['Investimentos', data.investments.length],
    ['Movimentos', (data.transactions ?? []).length],
    ['Metas', (data.goals ?? []).length],
    ['Bens', (data.assets ?? []).length],
  ] as const;

  return (
    <>
      <h1>Conta</h1>
      <div className="grid-2">
        <Card title="Perfil">
          <div className="profile-head">
            <span className="avatar avatar-lg" aria-hidden>
              {initials(user.name, user.email)}
            </span>
            <div>
              <strong>{user.name || user.email}</strong>
              <div className="muted small">{user.email}</div>
              <div className="muted small">Membro desde {date(user.createdAt)}</div>
            </div>
          </div>
          <form onSubmit={saveProfile} className="form-grid">
            <Field label="Nome">
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </Field>
            <button type="submit" className="primary" disabled={saving || name.trim() === (user.name ?? '')}>
              Guardar
            </button>
            {message && <p className={`full ${message.ok ? 'good' : 'bad'}`}>{message.text}</p>}
          </form>
          <button className="danger" onClick={signOut}>
            Terminar sessão
          </button>
        </Card>

        <Card title="Os teus dados">
          <p className="muted small">
            Guardados na tua conta e sincronizados entre dispositivos. Estado:{' '}
            <span className={`sync-${syncStatus}`}>
              {syncStatus === 'synced' ? 'sincronizado' : syncStatus === 'syncing' ? 'a sincronizar…' : 'erro de sincronização'}
            </span>
            {data.updatedAt > 0 && <> · última alteração {new Date(data.updatedAt).toLocaleString('pt-PT')}</>}
          </p>
          <ul className="list">
            {counts.map(([label, n]) => (
              <li key={label}>
                <span>{label}</span>
                <strong>{n}</strong>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Sharing />
      <NotificationsCard />

      <Card title="Exportar">
        <div className="preset-row">
          <a className="button primary" href="/api/export" download>
            Excel (.xlsx)
          </a>
          <a className="button ghost-link" href={`/relatorio?mes=${new Date().toISOString().slice(0, 7)}`}>
            Relatório do mês (PDF)
          </a>
        </div>
        <p className="muted small">O Excel tem uma folha por área (movimentos, despesas, créditos, investimentos…). O relatório abre pronto para imprimir ou guardar em PDF.</p>
      </Card>

      <Card title="Cópia de segurança">
        <div className="preset-row">
          <button onClick={exportJson}>Exportar JSON</button>
          <button className="ghost" onClick={() => fileRef.current?.click()}>
            Importar JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importJson(f);
              e.target.value = '';
            }}
          />
        </div>
      </Card>
    </>
  );
}
