'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ConflictError, fetchRemote, pushRemote } from './sync';
import { emptyData, type AppData, type Collection } from './types';
import { withCurrentSnapshot } from '../lib/summary';

/** Data saved before accounts existed; handed over once to the first user who signs in on this device. */
const LEGACY_KEY = 'financas:data';
const storageKey = (userId: string) => `financas:data:${userId}`;
const PUSH_DELAY_MS = 800;
const POLL_INTERVAL_MS = 30_000;

export type SyncStatus = 'syncing' | 'synced' | 'error';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

interface StoreValue {
  data: AppData;
  user: SessionUser;
  syncStatus: SyncStatus;
  upsert<C extends Collection>(collection: C, item: AppData[C][number]): void;
  remove(collection: Collection, id: string): void;
  update(patch: Partial<Omit<AppData, 'version' | 'updatedAt' | Collection>>): void;
  replaceAll(data: AppData): void;
}

const StoreContext = createContext<StoreValue | null>(null);

function readKey(key: string): AppData | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...emptyData(), ...(JSON.parse(raw) as AppData) } : null;
  } catch {
    return null;
  }
}

function loadLocal(userId: string): AppData {
  return readKey(storageKey(userId)) ?? emptyData();
}

function saveLocal(userId: string, data: AppData) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(data));
  } catch {
    // Storage full or blocked; the server copy still applies.
  }
}

function takeLegacy(): AppData | null {
  const legacy = readKey(LEGACY_KEY);
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // ignore
  }
  return legacy && legacy.updatedAt > 0 ? legacy : null;
}

/** Holds one signed-in user's data: cached per user in localStorage and synced with /api/data. */
export function StoreProvider({ user, children }: { user: SessionUser; children: ReactNode }) {
  const userId = user.id;
  const [data, setData] = useState<AppData>(emptyData);
  const [ready, setReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('syncing');
  const dirty = useRef(false);

  /** Replaces local data with a remote copy if it is newer. */
  const adopt = useCallback(
    (remote: AppData | null) => {
      if (!remote) return;
      setData((current) => {
        if (remote.updatedAt <= current.updatedAt) return current;
        const next = { ...emptyData(), ...remote };
        saveLocal(userId, next);
        return next;
      });
    },
    [userId],
  );

  // Load the local cache, reconcile with the server (newest wins), then poll for other devices' changes.
  useEffect(() => {
    let cancelled = false;
    const local = loadLocal(userId);
    setData(local);
    setReady(true);

    fetchRemote()
      .then(async (remote) => {
        if (cancelled) return;
        // First sign-in on a device that has pre-account data and no server copy yet: keep that data.
        const legacy = !remote && local.updatedAt === 0 ? takeLegacy() : null;
        const candidate = legacy ?? local;
        if (remote && remote.updatedAt >= candidate.updatedAt) adopt(remote);
        else if (candidate.updatedAt > 0) {
          if (legacy) {
            setData(legacy);
            saveLocal(userId, legacy);
          }
          await pushRemote(candidate);
        }
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
  }, [userId, adopt]);

  // Persist locally on every change and push to the server after a short pause.
  useEffect(() => {
    if (!dirty.current) return;
    saveLocal(userId, data);
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

  // Keep this month's snapshot up to date for the net-worth history (past months stay frozen).
  useEffect(() => {
    if (!ready || data.updatedAt === 0) return;
    const snapshots = withCurrentSnapshot(data);
    if (snapshots) {
      dirty.current = true;
      setData((d) => ({ ...d, snapshots, updatedAt: Date.now() }));
    }
  }, [data, ready]);

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

  const update = useCallback<StoreValue['update']>((patch) => mutate((d) => ({ ...d, ...patch })), [mutate]);

  const replaceAll = useCallback((next: AppData) => mutate(() => ({ ...emptyData(), ...next })), [mutate]);

  return (
    <StoreContext.Provider value={{ data, user, syncStatus, upsert, remove, update, replaceAll }}>
      {ready ? children : <div className="splash">A carregar…</div>}
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
