'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useStore, type SyncStatus } from '../data/store';
import { authClient } from '../lib/auth-client';

const NAV: { to: string; label: string; short?: string; icon: string }[] = [
  { to: '/', label: 'Resumo', icon: '◎' },
  { to: '/orcamento', label: 'Orçamento', short: 'Orçam.', icon: '≡' },
  { to: '/creditos', label: 'Créditos', icon: '⌂' },
  { to: '/subscricoes', label: 'Subscrições', short: 'Subscr.', icon: '↻' },
  { to: '/plano', label: 'Plano 50/30/20', short: 'Plano', icon: '%' },
  { to: '/cenarios', label: 'Cenários', short: 'Cenár.', icon: '↗' },
  { to: '/investimentos', label: 'Investimentos', short: 'Investir', icon: '▲' },
  { to: '/conta', label: 'Conta', icon: '●' },
];

const SYNC_LABEL: Record<SyncStatus, string> = {
  syncing: 'A sincronizar…',
  synced: 'Sincronizado',
  error: 'Erro de sincronização',
};

export function initials(name: string, email: string): string {
  const parts = (name || email).trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function Layout({ children }: { children: ReactNode }) {
  const { syncStatus, user } = useStore();
  const pathname = usePathname();
  const router = useRouter();

  const signOut = async () => {
    try {
      await authClient.signOut();
    } finally {
      router.replace('/login');
    }
  };

  return (
    <div className="app">
      <nav className="nav">
        <div className="brand">Finanças</div>
        {NAV.map((n) => (
          <Link key={n.to} href={n.to} className={`nav-link ${pathname === n.to ? 'active' : ''}`}>
            <span className="nav-icon" aria-hidden>
              {n.icon}
            </span>
            <span className="nav-label">{n.label}</span>
            <span className="nav-short">{n.short ?? n.label}</span>
          </Link>
        ))}
        <div className="nav-user">
          <Link href="/conta" className="nav-user-id">
            <span className="avatar" aria-hidden>
              {initials(user.name, user.email)}
            </span>
            <span className="nav-user-text">
              <strong>{user.name || user.email}</strong>
              <span className={`sync sync-${syncStatus}`}>{SYNC_LABEL[syncStatus]}</span>
            </span>
          </Link>
          <button className="ghost small-btn" onClick={signOut}>
            Sair
          </button>
        </div>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}
