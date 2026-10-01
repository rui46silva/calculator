import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { pool } from './db';

export const auth = betterAuth({
  database: pool,
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  plugins: [nextCookies()],
});
