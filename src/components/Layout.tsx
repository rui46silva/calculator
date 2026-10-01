'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStore, type SyncStatus } from '../data/store';

const NAV: { to: string; label: string; short?: string; icon: string }[] = [
  { to: '/', label: 'Resumo', icon: '◎' },
  { to: '/orcamento', label: 'Orçamento', short: 'Orçam.', icon: '≡' },
  { to: '/creditos', label: 'Créditos', icon: '⌂' },
  { to: '/subscricoes', label: 'Subscrições', short: 'Subscr.', icon: '↻' },
  { to: '/cenarios', label: 'Cenários', icon: '↗' },
  { to: '/investimentos', label: 'Investimentos', short: 'Investir', icon: '▲' },
  { to: '/conta', label: 'Conta', icon: '●' },
];

const SYNC_LABEL: Record<SyncStatus, string> = {
  local: 'Só neste dispositivo',
  syncing: 'A sincronizar…',
  synced: 'Sincronizado',
  error: 'Erro de sincronização',
};

export function Layout({ children }: { children: ReactNode }) {
  const { syncStatus } = useStore();
  const pathname = usePathname();
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
        <div className={`sync sync-${syncStatus}`}>{SYNC_LABEL[syncStatus]}</div>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}
