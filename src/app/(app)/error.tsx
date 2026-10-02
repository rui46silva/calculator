'use client';

import { useEffect } from 'react';

/** Keeps the menu usable when a page fails, and shows what went wrong so it can be reported. */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);

  return (
    <section className="card">
      <h1>Esta página teve um erro</h1>
      <p className="muted">Os teus dados não foram afetados. Tenta outra vez; se continuar, envia-nos a mensagem abaixo.</p>
      <pre className="error-detail">
        {error.message || 'Erro desconhecido'}
        {error.digest ? `\n(ref. ${error.digest})` : ''}
      </pre>
      <div className="preset-row">
        <button className="primary" onClick={reset}>
          Tentar outra vez
        </button>
        <button className="ghost" onClick={() => window.location.reload()}>
          Recarregar a página
        </button>
      </div>
    </section>
  );
}
