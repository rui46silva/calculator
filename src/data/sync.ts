import type { AppData } from './types';

export class ConflictError extends Error {
  constructor(public readonly server: AppData | null) {
    super('server has newer data');
  }
}

/** The account's data now lives in another document (joined or left a shared household). */
export class ScopeChangedError extends Error {
  constructor(public readonly scope: string) {
    super('data scope changed');
  }
}

export interface Remote {
  data: AppData | null;
  /** Which document the server is serving (personal or shared household). */
  scope: string;
}

export async function fetchRemote(): Promise<Remote> {
  const res = await fetch('/api/data', { cache: 'no-store' });
  if (!res.ok) throw new Error(`GET /api/data ${res.status}`);
  const body = (await res.json()) as { data: AppData | null; scope?: string };
  return { data: body.data, scope: body.scope ?? '' };
}

/** Saves `data` if the server still holds version `baseVersion`; otherwise throws ConflictError with the server's copy. */
export async function pushRemote(data: AppData, scope: string | null, baseVersion: number): Promise<void> {
  const res = await fetch('/api/data', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Base-Version': String(baseVersion),
      ...(scope ? { 'X-Data-Scope': scope } : {}),
    },
    body: JSON.stringify(data),
  });
  if (res.status === 409) {
    const body = (await res.json()) as { data?: AppData | null; error?: string; scope?: string };
    if (body.error === 'scope_changed') throw new ScopeChangedError(body.scope ?? '');
    throw new ConflictError(body.data ?? null);
  }
  if (!res.ok) throw new Error(`PUT /api/data ${res.status}`);
}
