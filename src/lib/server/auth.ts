import { createNeonAuth, type NeonAuth } from '@neondatabase/auth/next/server';

/** Accepted names for the Neon Auth URL; integrations and docs have used several. */
const BASE_URL_VARS = ['NEON_AUTH_BASE_URL', 'NEON_AUTH_URL', 'NEXT_PUBLIC_NEON_AUTH_URL'] as const;
const SECRET_VAR = 'NEON_AUTH_COOKIE_SECRET';
const MIN_SECRET_LENGTH = 32;

let instance: NeonAuth | undefined;

export function authBaseUrl(): string | undefined {
  for (const name of BASE_URL_VARS) {
    const value = process.env[name]?.trim();
    if (value) return value.replace(/\/+$/, '');
  }
}

/** Human-readable list of what's missing from the auth configuration (variable names only, never values). */
export function authConfigProblems(): string[] {
  const problems: string[] = [];
  if (!authBaseUrl()) problems.push(`${BASE_URL_VARS[0]} não está definida`);
  const secret = process.env[SECRET_VAR]?.trim();
  if (!secret) problems.push(`${SECRET_VAR} não está definida`);
  else if (secret.length < MIN_SECRET_LENGTH) problems.push(`${SECRET_VAR} tem menos de ${MIN_SECRET_LENGTH} caracteres`);
  return problems;
}

/**
 * Neon Auth server instance, or null when it isn't configured.
 * Created on first use so builds don't need the auth env vars.
 */
export function getAuth(): NeonAuth | null {
  if (authConfigProblems().length) return null;
  instance ??= createNeonAuth({ baseUrl: authBaseUrl()!, cookies: { secret: process.env[SECRET_VAR]!.trim() } });
  return instance;
}
