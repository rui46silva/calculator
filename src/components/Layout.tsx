'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useStore, type SyncStatus } from '../data/store';
import { authClient } from '../lib/auth-client';
import { ALL_ITEMS, MOBILE_PRIMARY, NAV_SECTIONS } from './nav';
import { useReminders } from '../lib/notifications';

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
  const { syncStatus, user, data } = useStore();
  useReminders(data, user.id, syncStatus !== 'syncing' || data.updatedAt > 0);
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => setMoreOpen(false), [pathname]);

  const signOut = async () => {
    try {
      await authClient.signOut();
    } finally {
      router.replace('/login');
    }
  };

  // The most specific matching item wins (/movimentos/importar over /movimentos).
  const activeTo = ALL_ITEMS.map((i) => i.to)
    .filter((to) => (to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`)))
    .sort((a, b) => b.length - a.length)[0];
  const isActive = (to: string) => to === activeTo;
  const primary = MOBILE_PRIMARY.map((to) => ALL_ITEMS.find((i) => i.to === to)!);
  const moreActive = !MOBILE_PRIMARY.some((to) => isActive(to));

  return (
    <div className="app">
      <header className="mobile-top">
        <span className="brand">Finanças</span>
        <span className={`sync sync-${syncStatus}`} aria-label={SYNC_LABEL[syncStatus]} title={SYNC_LABEL[syncStatus]} />
        <Link href="/conta" className="avatar" aria-label="Conta">
          {initials(user.name, user.email)}
        </Link>
      </header>

      <nav className="nav" aria-label="Navegação principal">
        <div className="brand">Finanças</div>
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="nav-section">
            <div className="nav-section-title">{section.title}</div>
            {section.items.map((n) => (
              <Link key={n.to} href={n.to} className={`nav-link ${isActive(n.to) ? 'active' : ''}`}>
                <span className="nav-icon" aria-hidden>
                  {n.icon}
                </span>
                <span className="nav-label">{n.label}</span>
              </Link>
            ))}
          </div>
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

      <nav className="bottom-nav" aria-label="Navegação">
        {primary.map((n) => (
          <Link key={n.to} href={n.to} className={`nav-link ${isActive(n.to) ? 'active' : ''}`}>
            <span className="nav-icon" aria-hidden>
              {n.icon}
            </span>
            <span className="nav-short">{n.short ?? n.label}</span>
          </Link>
        ))}
        <button className={`nav-link more-btn ${moreActive || moreOpen ? 'active' : ''}`} onClick={() => setMoreOpen((o) => !o)} aria-expanded={moreOpen}>
          <span className="nav-icon" aria-hidden>
            ⋯
          </span>
          <span className="nav-short">Mais</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="more-sheet" role="dialog" aria-label="Todas as páginas" onClick={() => setMoreOpen(false)}>
          <div className="more-panel" onClick={(e) => e.stopPropagation()}>
            {NAV_SECTIONS.map((section) => (
              <div key={section.title}>
                <div className="nav-section-title">{section.title}</div>
                <div className="more-grid">
                  {section.items.map((n) => (
                    <Link key={n.to} href={n.to} className={`more-item ${isActive(n.to) ? 'active' : ''}`}>
                      <span aria-hidden>{n.icon}</span>
                      {n.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
            <button className="danger more-signout" onClick={signOut}>
              Terminar sessão
            </button>
          </div>
        </div>
      )}

      <main className="main">{children}</main>
    </div>
  );
}
