import type { AppData } from './types';

export class ConflictError extends Error {
  constructor(public readonly server: AppData | null) {
    super('server has newer data');
  }
}

export async function fetchRemote(): Promise<AppData | null> {
  const res = await fetch('/api/data', { cache: 'no-store' });
  if (!res.ok) throw new Error(`GET /api/data ${res.status}`);
  return ((await res.json()) as { data: AppData | null }).data;
}

/** Throws ConflictError (with the server's copy) when the server already holds newer data. */
export async function pushRemote(data: AppData): Promise<void> {
  const res = await fetch('/api/data', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (res.status === 409) throw new ConflictError(((await res.json()) as { data: AppData | null }).data);
  if (!res.ok) throw new Error(`PUT /api/data ${res.status}`);
}
