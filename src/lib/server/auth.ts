import { createNeonAuth, type NeonAuth } from '@neondatabase/auth/next/server';

let instance: NeonAuth | undefined;

/**
 * Neon Auth server instance, or null when it isn't configured (the app then works in local-only mode).
 * Created on first use so builds don't need the auth env vars.
 */
export function getAuth(): NeonAuth | null {
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  const secret = process.env.NEON_AUTH_COOKIE_SECRET;
  if (!baseUrl || !secret) return null;
  instance ??= createNeonAuth({ baseUrl, cookies: { secret } });
  return instance;
}
