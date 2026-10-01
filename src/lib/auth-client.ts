'use client';

import { createAuthClient } from '@neondatabase/auth/next';

/** Talks to /api/auth, which proxies to Neon Auth. */
export const authClient = createAuthClient();
