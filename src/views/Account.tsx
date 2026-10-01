'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useStore } from '../data/store';
import type { AppData } from '../data/types';
import { authClient } from '../lib/auth-client';
import { Card, Field } from '../components/ui';

export function Account() {
  const { data, user, syncStatus, replaceAll } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);

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

  return (
    <>
      <h1>Conta</h1>
      <Card title="Sincronização entre dispositivos">
        {user ? (
          <>
            <p>
              Sessão iniciada como <strong>{user.email}</strong>. Estado: {syncStatus === 'synced' ? 'sincronizado' : syncStatus}.
            </p>
            <button className="ghost" onClick={() => authClient.signOut()}>
              Terminar sessão
            </button>
          </>
        ) : (
          <AuthForm />
        )}
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

// Neon Auth reports Supabase-style codes; the upper-case ones are Better Auth's.
const AUTH_ERRORS: Record<string, string> = {
  invalid_credentials: 'Email ou password incorretos.',
  INVALID_EMAIL_OR_PASSWORD: 'Email ou password incorretos.',
  user_already_exists: 'Já existe uma conta com este email.',
  email_exists: 'Já existe uma conta com este email.',
  USER_ALREADY_EXISTS: 'Já existe uma conta com este email.',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'Já existe uma conta com este email.',
  weak_password: 'A password é demasiado fraca (mínimo 8 caracteres).',
  PASSWORD_TOO_SHORT: 'A password é demasiado curta.',
  email_address_invalid: 'O email não é válido.',
  email_not_confirmed: 'Confirma o teu email antes de entrar.',
  over_request_rate_limit: 'Demasiadas tentativas. Espera um pouco e tenta de novo.',
  AUTH_NOT_CONFIGURED: 'O login ainda não está configurado neste servidor.',
};

function authErrorMessage(err: unknown): string {
  const e = err as { code?: string; message?: string } | null;
  return (e?.code && AUTH_ERRORS[e.code]) || e?.message || 'Não foi possível entrar. Tenta novamente.';
}

function AuthForm() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // The Neon Auth client throws on API errors; older Better Auth clients return { error } instead.
      const { error } =
        mode === 'signin'
          ? await authClient.signIn.email({ email, password })
          : await authClient.signUp.email({ email, password, name: name || email.split('@')[0] });
      if (error) setError(authErrorMessage(error));
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <p className="muted">Entra para sincronizar os teus dados entre o computador e o telemóvel.</p>
      <div className="form-grid">
        {mode === 'signup' && (
          <Field label="Nome">
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </Field>
        )}
        <Field label="Email">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </Field>
        <Field label="Password">
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          />
        </Field>
      </div>
      {error && <p className="bad">{error}</p>}
      <div className="preset-row">
        <button type="submit" className="primary" disabled={busy}>
          {mode === 'signin' ? 'Entrar' : 'Criar conta'}
        </button>
        <button type="button" className="ghost" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
          {mode === 'signin' ? 'Criar conta nova' : 'Já tenho conta'}
        </button>
      </div>
    </form>
  );
}
