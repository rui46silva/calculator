'use client';

import { useEffect } from 'react';
import type { AppData } from '../data/types';
import { remindersFor } from './reminders';

const ENABLED_KEY = 'financas:notify';
const sentKey = (userId: string) => `financas:notified:${userId}`;
const CHECK_EVERY_MS = 30 * 60_000;
const KEEP_DAYS = 40;

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
}

export function notificationsEnabled(): boolean {
  if (!notificationsSupported()) return false;
  try {
    return Notification.permission === 'granted' && localStorage.getItem(ENABLED_KEY) === '1';
  } catch {
    return false;
  }
}

/** Asks for permission and turns reminders on for this device. Returns the resulting permission. */
export async function enableNotifications(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationsSupported()) return 'unsupported';
  const permission = await Notification.requestPermission();
  try {
    localStorage.setItem(ENABLED_KEY, permission === 'granted' ? '1' : '0');
  } catch {
    // ignore
  }
  return permission;
}

export function disableNotifications() {
  try {
    localStorage.setItem(ENABLED_KEY, '0');
  } catch {
    // ignore
  }
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!notificationsSupported()) return null;
  return navigator.serviceWorker.register('/sw.js').then(
    () => navigator.serviceWorker.ready,
    () => null,
  );
}

export async function showTestNotification() {
  const reg = await registration();
  await reg?.showNotification('Finanças: notificações ativas', { body: 'Vais receber avisos de pagamentos, orçamentos e metas.', icon: '/icon.svg', tag: 'test', data: { url: '/' } });
}

/** Shows each due reminder once per device, while the app is open (checked on load, on focus and every 30 min). */
export function useReminders(data: AppData, userId: string, ready: boolean) {
  useEffect(() => {
    if (!ready || !notificationsSupported()) return;
    void registration();
    const check = async () => {
      if (!notificationsEnabled()) return;
      let sent: Record<string, number> = {};
      try {
        sent = JSON.parse(localStorage.getItem(sentKey(userId)) ?? '{}') as Record<string, number>;
      } catch {
        sent = {};
      }
      const due = remindersFor(data).filter((r) => !sent[r.key]);
      if (!due.length) return;
      const reg = await registration();
      if (!reg) return;
      for (const r of due) {
        await reg.showNotification(r.title, { body: r.body, tag: r.key, icon: '/icon.svg', data: { url: r.url } });
        sent[r.key] = Date.now();
      }
      const cutoff = Date.now() - KEEP_DAYS * 86_400_000;
      for (const [k, t] of Object.entries(sent)) if (t < cutoff) delete sent[k];
      try {
        localStorage.setItem(sentKey(userId), JSON.stringify(sent));
      } catch {
        // ignore
      }
    };
    void check();
    const timer = setInterval(check, CHECK_EVERY_MS);
    const onVisible = () => document.visibilityState === 'visible' && void check();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [data, userId, ready]);
}
