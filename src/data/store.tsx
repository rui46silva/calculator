'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ConflictError, ScopeChangedError, fetchRemote, pushRemote } from './sync';
import { emptyData, type AppData, type Collection } from './types';
import { withCurrentSnapshot } from '../lib/summary';
import { mergeData } from './merge';

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

export interface HouseholdMember {
  userId: string;
  name: string;
  email: string;
  role: 'owner' | 'member';
}

export interface Household {
  id: string;
  name: string;
  members: HouseholdMember[];
}

interface StoreValue {
  data: AppData;
  user: SessionUser;
  syncStatus: SyncStatus;
  /** True once the data has been reconciled with the server (safe to compare against, e.g. for duplicates). */
  loaded: boolean;
  household: Household | null;
  refreshHousehold(): Promise<void>;
  upsert<C extends Collection>(collection: C, item: AppData[C][number]): void;
  remove(collection: Collection, id: string): void;
  update(patch: Partial<Omit<AppData, 'version' | 'updatedAt'>>): void;
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

const scopeKey = (userId: string) => `financas:scope:${userId}`;
/** Last version known to be on the server: the common ancestor for merging concurrent edits. */
const baseKey = (userId: string) => `financas:base:${userId}`;

function loadBase(userId: string): AppData | null {
  return readKey(baseKey(userId));
}

function saveBase(userId: string, data: AppData) {
  try {
    localStorage.setItem(baseKey(userId), JSON.stringify(data));
  } catch {
    // ignore
  }
}

function loadScope(userId: string): string | null {
  try {
    return localStorage.getItem(scopeKey(userId));
  } catch {
    return null;
  }
}

function saveScope(userId: string, scope: string) {
  try {
    localStorage.setItem(scopeKey(userId), scope);
  } catch {
    // ignore
  }
}

/** Drops this user's local cache and reloads, so the app starts from the server's current document. */
export function reloadFresh(userId: string) {
  try {
    localStorage.removeItem(storageKey(userId));
    localStorage.removeItem(scopeKey(userId));
    localStorage.removeItem(baseKey(userId));
  } catch {
    // ignore
  }
  window.location.reload();
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
  /** True once local data has been reconciled with the server copy at least once. */
  const [reconciled, setReconciled] = useState(false);
  const dirty = useRef(false);
  /** Which server document this data belongs to (personal or a shared household). */
  const scope = useRef<string | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);

  /** Last version known to be on the server (common ancestor for merges). */
  const base = useRef<AppData | null>(null);
  const setBase = useCallback(
    (d: AppData) => {
      base.current = d;
      saveBase(userId, d);
    },
    [userId],
  );

  /** Takes a server copy when there are no local edits waiting to be saved. */
  const adopt = useCallback(
    (remote: AppData | null) => {
      if (!remote || dirty.current) return;
      setData((current) => {
        if (remote.updatedAt <= current.updatedAt) return current;
        const next = { ...emptyData(), ...remote };
        saveLocal(userId, next);
        setBase(next);
        return next;
      });
    },
    [userId, setBase],
  );

  /** Server copy changed under our edits: merge both and save again (the push effect re-runs). */
  const mergeWith = useCallback(
    (remote: AppData | null) => {
      if (!remote) return;
      const server = { ...emptyData(), ...remote };
      setData((current) => {
        const merged = mergeData(base.current, current, server);
        setBase(server);
        dirty.current = true;
        return merged;
      });
    },
    [setBase],
  );

  // Load the local cache, reconcile with the server, then poll for other devices' changes.
  useEffect(() => {
    let cancelled = false;
    let local = loadLocal(userId);
    base.current = loadBase(userId);
    setData(local);
    setReady(true);

    fetchRemote()
      .then(async (remote) => {
        if (cancelled) return;
        const cachedScope = loadScope(userId);
        if (cachedScope && cachedScope !== remote.scope) {
          // The cache belongs to another document (joined or left a shared account): never push it.
          local = emptyData();
          base.current = null;
          dirty.current = false;
          setData(local);
          saveLocal(userId, local);
        }
        scope.current = remote.scope;
        saveScope(userId, remote.scope);

        // First sign-in on a device with pre-account data and no server copy yet: keep that data.
        const personal = remote.scope === userId;
        const legacy = !remote.data && personal && local.updatedAt === 0 ? takeLegacy() : null;
        const candidate = legacy ?? local;
        const server = remote.data ? { ...emptyData(), ...remote.data } : null;
        // Local edits not yet on the server (made offline, or before the last push finished).
        const unsynced = candidate.updatedAt > 0 && (!base.current || candidate.updatedAt !== base.current.updatedAt);

        if (server && !unsynced) {
          // Nothing pending here: the server copy is the truth.
          dirty.current = false;
          setData(server);
          saveLocal(userId, server);
          setBase(server);
        } else if (server && unsynced) {
          const merged = mergeData(base.current, candidate, server);
          setBase(server);
          dirty.current = true;
          setData(merged);
        } else if (candidate.updatedAt > 0) {
          if (legacy) {
            setData(legacy);
            saveLocal(userId, legacy);
          }
          await pushRemote(candidate, scope.current, 0);
          setBase(candidate);
        }
        if (!cancelled) {
          setSyncStatus('synced');
          setReconciled(true);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ScopeChangedError) return reloadFresh(userId);
        if (err instanceof ConflictError) {
          mergeWith(err.server);
          setReconciled(true);
        } else setSyncStatus('error');
      });

    const refresh = () => {
      if (document.visibilityState !== 'visible' || dirty.current) return;
      fetchRemote().then((remote) => {
        if (scope.current && remote.scope !== scope.current) return reloadFresh(userId);
        adopt(remote.data);
      }, () => setSyncStatus('error'));
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
  }, [userId, adopt, mergeWith, setBase]);

  // Shared household (members' names for "who paid"); refreshed after changes on the Account page.
  const refreshHousehold = useCallback(async () => {
    try {
      const res = await fetch('/api/household', { cache: 'no-store' });
      if (res.ok) setHousehold(((await res.json()) as { household: Household | null }).household);
    } catch {
      // Offline: keep what we had.
    }
  }, []);
  useEffect(() => {
    if (reconciled) void refreshHousehold();
  }, [reconciled, refreshHousehold]);

  // Persist locally on every change and push to the server after a short pause.
  useEffect(() => {
    if (!dirty.current) return;
    saveLocal(userId, data);
    setSyncStatus('syncing');
    const timer = setTimeout(() => {
      const sent = data;
      pushRemote(sent, scope.current, base.current?.updatedAt ?? 0)
        .then(() => {
          setBase(sent);
          // Only clear the flag if nothing changed while the request was in flight.
          setData((current) => {
            if (current === sent) dirty.current = false;
            return current;
          });
          setSyncStatus('synced');
        })
        .catch((err) => {
          if (err instanceof ScopeChangedError) return reloadFresh(userId);
          if (err instanceof ConflictError) mergeWith(err.server);
          else setSyncStatus('error');
        });
    }, PUSH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [data, userId, mergeWith, setBase]);

  // Keep this month's snapshot up to date for the net-worth history (past months stay frozen).
  // Only after the first sync: writing earlier would stamp a stale local copy as newest and
  // overwrite changes made on another device.
  useEffect(() => {
    if (!ready || !reconciled || data.updatedAt === 0) return;
    const snapshots = withCurrentSnapshot(data);
    if (snapshots) {
      dirty.current = true;
      setData((d) => ({ ...d, snapshots, updatedAt: Date.now() }));
    }
  }, [data, ready, reconciled]);

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
    <StoreContext.Provider value={{ data, user, syncStatus, loaded: reconciled, household, refreshHousehold, upsert, remove, update, replaceAll }}>
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
