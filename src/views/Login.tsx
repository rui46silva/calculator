'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { Field } from '@/components/ui';

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

const FEATURES = [
  ['Orçamento', 'Rendimentos e despesas por categoria, incluindo as anuais.'],
  ['Créditos', 'Plano de amortização, amortizações antecipadas e subidas da Euribor.'],
  ['Subscrições', 'Quanto pagas por ano e o que vale a pena cancelar.'],
  ['Investimentos', 'ETFs com cotações reais e cenários baseados no histórico do mercado.'],
] as const;

export function LoginView() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session?.user) router.replace('/');
  }, [session, router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // The Neon Auth client throws on API errors; Better Auth clients return { error } instead.
      const { error } =
        mode === 'signin'
          ? await authClient.signIn.email({ email, password })
          : await authClient.signUp.email({ email, password, name: name.trim() || email.split('@')[0] });
      if (error) setError(authErrorMessage(error));
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <section className="login-intro">
        <div className="brand">Finanças</div>
        <h1>As tuas finanças pessoais, num só sítio.</h1>
        <p className="muted">Organiza despesas, créditos e investimentos e vê como evoluem ao longo dos anos.</p>
        <ul className="login-features">
          {FEATURES.map(([title, text]) => (
            <li key={title}>
              <strong>{title}</strong>
              <span className="muted">{text}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card login-card">
        <h2>{mode === 'signin' ? 'Entrar' : 'Criar conta'}</h2>
        <p className="muted small">
          {mode === 'signin'
            ? 'Os teus dados ficam guardados na tua conta e disponíveis em todos os dispositivos.'
            : 'Cria uma conta para guardar os teus dados em segurança.'}
        </p>
        <form onSubmit={submit} className="login-form">
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
          {error && (
            <p className="bad" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="primary" disabled={busy}>
            {busy ? 'Aguarda…' : mode === 'signin' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>
        <p className="small login-switch">
          {mode === 'signin' ? 'Ainda não tens conta?' : 'Já tens conta?'}{' '}
          <button
            type="button"
            className="link"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setError(null);
            }}
          >
            {mode === 'signin' ? 'Criar conta nova' : 'Entrar'}
          </button>
        </p>
      </section>
    </div>
  );
}
