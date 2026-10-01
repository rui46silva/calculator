'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { authClient } from '@/lib/auth-client';
import { ConflictError, fetchRemote, pushRemote } from './sync';
import { emptyData, type AppData, type Collection } from './types';

const STORAGE_KEY = 'financas:data';
const PUSH_DELAY_MS = 800;
const POLL_INTERVAL_MS = 30_000;

export type SyncStatus = 'local' | 'syncing' | 'synced' | 'error';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

interface StoreValue {
  data: AppData;
  user: SessionUser | null;
  syncStatus: SyncStatus;
  upsert<C extends Collection>(collection: C, item: AppData[C][number]): void;
  remove(collection: Collection, id: string): void;
  replaceAll(data: AppData): void;
}

const StoreContext = createContext<StoreValue | null>(null);

function loadLocal(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...emptyData(), ...(JSON.parse(raw) as AppData) };
  } catch {
    // Corrupt or unavailable storage: start fresh.
  }
  return emptyData();
}

function saveLocal(data: AppData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or blocked; remote sync still applies when signed in.
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(emptyData);
  const [hydrated, setHydrated] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local');
  const dirty = useRef(false);
  const { data: session } = authClient.useSession();
  const user = session?.user ? { id: session.user.id, email: session.user.email, name: session.user.name } : null;
  const userId = user?.id;

  // localStorage is only available in the browser, so load it after the first render.
  useEffect(() => {
    setData(loadLocal());
    setHydrated(true);
  }, []);

  /** Replaces local data with a remote copy if it is newer. */
  const adopt = useCallback((remote: AppData | null) => {
    if (!remote) return;
    setData((current) => {
      if (remote.updatedAt <= current.updatedAt) return current;
      saveLocal(remote);
      return remote;
    });
  }, []);

  // On sign-in: reconcile local and remote copies (newest wins), then poll for changes from other devices.
  useEffect(() => {
    if (!userId || !hydrated) {
      setSyncStatus('local');
      return;
    }
    let cancelled = false;
    setSyncStatus('syncing');
    fetchRemote()
      .then(async (remote) => {
        if (cancelled) return;
        const local = loadLocal();
        if (remote && remote.updatedAt >= local.updatedAt) adopt(remote);
        else if (local.updatedAt > 0) await pushRemote(local);
        if (!cancelled) setSyncStatus('synced');
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ConflictError) {
          adopt(err.server);
          setSyncStatus('synced');
        } else setSyncStatus('error');
      });

    const refresh = () => {
      if (document.visibilityState !== 'visible' || dirty.current) return;
      fetchRemote().then(adopt, () => setSyncStatus('error'));
    };
    const timer = setInterval(refresh, POLL_INTERVAL_MS);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [userId, hydrated, adopt]);

  // Persist locally on every change and push to the server after a short pause.
  useEffect(() => {
    if (!dirty.current) return;
    saveLocal(data);
    if (!userId) return;
    setSyncStatus('syncing');
    const timer = setTimeout(() => {
      pushRemote(data)
        .then(() => {
          dirty.current = false;
          setSyncStatus('synced');
        })
        .catch((err) => {
          if (err instanceof ConflictError) {
            dirty.current = false;
            adopt(err.server);
            setSyncStatus('synced');
          } else setSyncStatus('error');
        });
    }, PUSH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [data, userId, adopt]);

  const mutate = useCallback((fn: (d: AppData) => AppData) => {
    dirty.current = true;
    setData((d) => ({ ...fn(d), updatedAt: Date.now() }));
  }, []);

  const upsert = useCallback<StoreValue['upsert']>(
    (collection, item) =>
      mutate((d) => {
        const list = d[collection] as { id: string }[];
        const exists = list.some((x) => x.id === item.id);
        return {
          ...d,
          [collection]: exists ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item],
        };
      }),
    [mutate],
  );

  const remove = useCallback<StoreValue['remove']>(
    (collection, id) =>
      mutate((d) => ({ ...d, [collection]: (d[collection] as { id: string }[]).filter((x) => x.id !== id) })),
    [mutate],
  );

  const replaceAll = useCallback((next: AppData) => mutate(() => ({ ...emptyData(), ...next })), [mutate]);

  return (
    <StoreContext.Provider value={{ data, user, syncStatus, upsert, remove, replaceAll }}>
      {hydrated ? children : null}
    </StoreContext.Provider>
  );
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}

export function newId(): string {
  return crypto.randomUUID();
}
