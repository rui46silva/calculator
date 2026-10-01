'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { Field } from '@/components/ui';
import { WelcomeDialog } from '@/components/WelcomeDialog';

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
};

function authErrorMessage(err: unknown): string {
  const e = err as { code?: string; message?: string; status?: number } | null;
  const message = e?.message ?? '';
  if (/origin/i.test(message) || e?.code === 'INVALID_ORIGIN') {
    return `Este endereço (${window.location.origin}) não está autorizado no Neon Auth. Na consola do Neon → Auth, adiciona-o aos domínios permitidos.`;
  }
  if (/invalid otp/i.test(message)) return 'Código incorreto. Confirma os 6 dígitos do email.';
  if (/otp expired/i.test(message)) return 'O código expirou. Pede um novo código.';
  if (/too many attempts/i.test(message)) return 'Demasiadas tentativas. Pede um novo código.';
  if (/verif|not confirmed/i.test(message)) return AUTH_ERRORS.email_not_confirmed;
  const known = e?.code && AUTH_ERRORS[e.code];
  if (known) return known;
  return message ? `${message}${e?.status ? ` (erro ${e.status})` : ''}` : 'Não foi possível entrar. Tenta novamente.';
}

/** True when signing in failed only because the email hasn't been verified yet. */
function isUnverified(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  return e?.code === 'email_not_confirmed' || e?.code === 'EMAIL_NOT_VERIFIED' || /not verified|not confirmed/i.test(e?.message ?? '');
}

const TIMEOUT_MS = 20_000;
const RESEND_COOLDOWN_S = 30;
const CODE_LENGTH = 6;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('O servidor de autenticação não respondeu. Tenta novamente daqui a pouco.')), TIMEOUT_MS),
    ),
  ]);
}

/** Normalises `{ data, error }` results and thrown errors into a single thrown error. */
async function call<T extends { error?: unknown } | null | undefined>(promise: Promise<T>): Promise<T> {
  const result = await withTimeout(promise);
  if (result?.error) throw result.error;
  return result;
}

async function hasSession(): Promise<boolean> {
  const session = await withTimeout(authClient.getSession());
  return !!session?.data?.user;
}

const FEATURES = [
  ['Orçamento', 'Rendimentos e despesas por categoria, incluindo as anuais.'],
  ['Créditos', 'Plano de amortização, amortizações antecipadas e subidas da Euribor.'],
  ['Subscrições', 'Quanto pagas por ano e o que vale a pena cancelar.'],
  ['Investimentos', 'ETFs com cotações reais e cenários baseados no histórico do mercado.'],
] as const;

type Step = 'signin' | 'signup' | 'verify';

export function LoginView() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [step, setStep] = useState<Step>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [welcome, setWelcome] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  // Someone who already has a session when the page opens goes straight to the app. Checked only once:
  // sessions created by the forms below must not navigate away before the welcome dialog shows.
  const initialCheck = useRef(false);
  useEffect(() => {
    if (isPending || initialCheck.current) return;
    initialCheck.current = true;
    if (session?.user) router.replace('/');
  }, [isPending, session, router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (step === 'verify') codeRef.current?.focus();
  }, [step]);

  const go = (next: Step) => {
    setStep(next);
    setError(null);
    setInfo(null);
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await fn();
    } catch (err) {
      console.error('Auth error', err);
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const startVerification = (message: string) => {
    setCode('');
    setStep('verify');
    setCooldown(RESEND_COOLDOWN_S);
    setInfo(message);
  };

  const signIn = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      try {
        await call(authClient.signIn.email({ email, password }));
      } catch (err) {
        if (!isUnverified(err)) throw err;
        // Account exists but was never verified: send a fresh code and ask for it.
        await call(authClient.emailOtp.sendVerificationOtp({ email, type: 'email-verification' }));
        startVerification(`Ainda falta confirmar o teu email. Enviámos um código para ${email}.`);
        return;
      }
      if (await hasSession()) window.location.assign('/');
      else setError('Não foi possível iniciar sessão: o servidor não devolveu uma sessão. Abre /api/health para ver o diagnóstico.');
    });
  };

  const signUp = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await call(authClient.signUp.email({ email, password, name: name.trim() || email.split('@')[0] }));
      if (await hasSession()) setWelcome(true);
      else startVerification(`Enviámos um código de ${CODE_LENGTH} dígitos para ${email}.`);
    });
  };

  const verify = (e: FormEvent) => {
    e.preventDefault();
    if (code.length !== CODE_LENGTH) return;
    void run(async () => {
      await call(authClient.emailOtp.verifyEmail({ email, otp: code }));
      // Some setups sign in automatically after verification; otherwise sign in with the password just entered.
      if (!(await hasSession())) await call(authClient.signIn.email({ email, password }));
      if (await hasSession()) setWelcome(true);
      else {
        setInfo('Email confirmado. Já podes entrar.');
        setStep('signin');
      }
    });
  };

  const resend = () =>
    void run(async () => {
      await call(authClient.emailOtp.sendVerificationOtp({ email, type: 'email-verification' }));
      setCooldown(RESEND_COOLDOWN_S);
      setCode('');
      setInfo(`Enviámos um novo código para ${email}.`);
    });

  const messages = (
    <>
      {error && (
        <p className="form-msg bad" role="alert">
          {error}
        </p>
      )}
      {info && (
        <p className="form-msg good" role="status">
          {info}
        </p>
      )}
    </>
  );

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
        {step === 'signup' && (
          <ol className="steps" aria-label="Passos para criar conta">
            <li className="on">Dados</li>
            <li>Código</li>
            <li>Pronto</li>
          </ol>
        )}
        {step === 'verify' && (
          <ol className="steps" aria-label="Passos para criar conta">
            <li className="done">Dados</li>
            <li className="on">Código</li>
            <li>Pronto</li>
          </ol>
        )}

        {step === 'signin' && (
          <>
            <h2>Entrar</h2>
            <p className="muted small">Os teus dados ficam guardados na tua conta e disponíveis em todos os dispositivos.</p>
            <form onSubmit={signIn} className="login-form">
              <Field label="Email">
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </Field>
              <Field label="Password">
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
              </Field>
              {messages}
              <button type="submit" className="primary" disabled={busy}>
                {busy ? 'Aguarda…' : 'Entrar'}
              </button>
            </form>
            <p className="small login-switch">
              Ainda não tens conta?{' '}
              <button type="button" className="link" onClick={() => go('signup')}>
                Criar conta nova
              </button>
            </p>
          </>
        )}

        {step === 'signup' && (
          <>
            <h2>Criar conta</h2>
            <p className="muted small">Depois enviamos-te um código por email para confirmar que o endereço é teu.</p>
            <form onSubmit={signUp} className="login-form">
              <Field label="Nome">
                <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </Field>
              <Field label="Email">
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </Field>
              <Field label="Password (mínimo 8 caracteres)">
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </Field>
              {messages}
              <button type="submit" className="primary" disabled={busy}>
                {busy ? 'Aguarda…' : 'Continuar'}
              </button>
            </form>
            <p className="small login-switch">
              Já tens conta?{' '}
              <button type="button" className="link" onClick={() => go('signin')}>
                Entrar
              </button>
            </p>
          </>
        )}

        {step === 'verify' && (
          <>
            <h2>Confirma o teu email</h2>
            <p className="muted small">
              Escreve o código de {CODE_LENGTH} dígitos que enviámos para <strong>{email}</strong>. Se não o encontrares, vê a pasta de spam.
            </p>
            <form onSubmit={verify} className="login-form">
              <Field label="Código de verificação">
                <input
                  ref={codeRef}
                  className="otp-input"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern={`\\d{${CODE_LENGTH}}`}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
                  placeholder="••••••"
                />
              </Field>
              {messages}
              <button type="submit" className="primary" disabled={busy || code.length !== CODE_LENGTH}>
                {busy ? 'A confirmar…' : 'Confirmar'}
              </button>
            </form>
            <div className="small login-switch otp-actions">
              <button type="button" className="link" onClick={resend} disabled={busy || cooldown > 0}>
                {cooldown > 0 ? `Reenviar código (${cooldown}s)` : 'Reenviar código'}
              </button>
              <span className="muted">·</span>
              <button type="button" className="link" onClick={() => go('signup')}>
                Mudar email
              </button>
            </div>
          </>
        )}
      </section>

      <WelcomeDialog open={welcome} name={name.trim() || email.split('@')[0]} onContinue={() => window.location.assign('/')} />
    </div>
  );
}
