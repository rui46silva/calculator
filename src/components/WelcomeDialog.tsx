'use client';

import { useEffect, useRef } from 'react';

const CONFETTI = Array.from({ length: 14 }, (_, i) => i);

/** Shown once an account has been created and verified: animated check, short welcome, and the way in. */
export function WelcomeDialog({ open, name, onContinue }: { open: boolean; name: string; onContinue: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      button.current?.focus();
    }
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="welcome"
      aria-labelledby="welcome-title"
      onCancel={(e) => {
        // Escape still enters the app rather than leaving an empty login page behind.
        e.preventDefault();
        onContinue();
      }}
    >
      <div className="welcome-art" aria-hidden>
        {CONFETTI.map((i) => (
          <span key={i} className="confetti" style={{ ['--i' as string]: i }} />
        ))}
        <svg viewBox="0 0 52 52" className="welcome-check">
          <circle cx="26" cy="26" r="24" />
          <path d="M15 27 l7 7 l15 -16" />
        </svg>
      </div>
      <h2 id="welcome-title">Conta criada!</h2>
      <p>
        Bem-vindo{name ? `, ${name}` : ''}. A tua conta está pronta e os teus dados vão ficar guardados em segurança e disponíveis em
        todos os dispositivos.
      </p>
      <ul className="welcome-next">
        <li>Adiciona os teus rendimentos e despesas em Orçamento</li>
        <li>Regista créditos e subscrições</li>
        <li>Explora ETFs e cenários em Investimentos</li>
      </ul>
      <button ref={button} className="primary" onClick={onContinue}>
        Começar
      </button>
    </dialog>
  );
}
