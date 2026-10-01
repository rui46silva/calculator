import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { fetchRemote, pushRemote, subscribeRemote } from './sync';
import { emptyData, type AppData, type Collection } from './types';

const STORAGE_KEY = 'financas:data';
const PUSH_DELAY_MS = 800;

export type SyncStatus = 'local' | 'syncing' | 'synced' | 'error';

interface StoreValue {
  data: AppData;
  session: Session | null;
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
  const [data, setData] = useState<AppData>(loadLocal);
  const [session, setSession] = useState<Session | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local');
  const dirty = useRef(false);
  const userId = session?.user.id;

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // On sign-in: reconcile local and remote copies (newest wins), then listen for other devices.
  useEffect(() => {
    if (!supabase || !userId) {
      setSyncStatus('local');
      return;
    }
    const client = supabase;
    let cancelled = false;
    setSyncStatus('syncing');
    fetchRemote(client, userId)
      .then(async (remote) => {
        if (cancelled) return;
        const local = loadLocal();
        if (remote && remote.updatedAt >= local.updatedAt) {
          setData(remote);
          saveLocal(remote);
        } else if (local.updatedAt > 0) {
          await pushRemote(client, userId, local);
        }
        if (!cancelled) setSyncStatus('synced');
      })
      .catch(() => !cancelled && setSyncStatus('error'));

    const unsubscribe = subscribeRemote(client, userId, (remote) => {
      setData((current) => {
        if (remote.updatedAt <= current.updatedAt) return current;
        saveLocal(remote);
        return remote;
      });
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [userId]);

  // Persist locally on every change and push to Supabase after a short pause.
  useEffect(() => {
    if (!dirty.current) return;
    saveLocal(data);
    if (!supabase || !userId) return;
    const client = supabase;
    setSyncStatus('syncing');
    const timer = setTimeout(() => {
      pushRemote(client, userId, data)
        .then(() => {
          dirty.current = false;
          setSyncStatus('synced');
        })
        .catch(() => setSyncStatus('error'));
    }, PUSH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [data, userId]);

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
    <StoreContext.Provider value={{ data, session, syncStatus, upsert, remove, replaceAll }}>
      {children}
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
