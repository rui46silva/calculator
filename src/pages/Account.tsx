import { useRef, useState, type FormEvent } from 'react';
import { useStore } from '../data/store';
import { supabase } from '../data/supabase';
import type { AppData } from '../data/types';
import { Card, Field } from '../components/ui';

export function Account() {
  const { data, session, syncStatus, replaceAll } = useStore();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const signIn = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    setMessage(error ? `Erro: ${error.message}` : 'Enviámos-te um link de acesso por email.');
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

  return (
    <>
      <h1>Conta</h1>
      <Card title="Sincronização entre dispositivos">
        {!supabase ? (
          <p className="muted">
            A sincronização não está configurada. Os dados ficam guardados apenas neste dispositivo. Define{' '}
            <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> para ativar.
          </p>
        ) : session ? (
          <>
            <p>
              Sessão iniciada como <strong>{session.user.email}</strong>. Estado: {syncStatus === 'synced' ? 'sincronizado' : syncStatus}.
            </p>
            <button className="ghost" onClick={() => supabase!.auth.signOut()}>
              Terminar sessão
            </button>
          </>
        ) : (
          <form onSubmit={signIn} className="form-grid">
            <Field label="Email">
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <button type="submit" className="primary">
              Enviar link de acesso
            </button>
            {message && <p className="full">{message}</p>}
          </form>
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
