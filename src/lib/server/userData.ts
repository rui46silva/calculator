import { pool } from './db';
import { getAuth } from './auth';
import type { AppData } from '@/data/types';
import { householdIdOf, householdKey } from './household';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

export async function sessionUser(): Promise<SessionUser | null> {
  const auth = getAuth();
  if (!auth) return null;
  const { data } = await auth.getSession();
  const u = data?.user;
  return u ? { id: u.id, email: u.email, name: u.name } : null;
}

/** Key of the data document a user reads and writes: the shared household's if they belong to one, else their own. */
export async function dataKeyFor(userId: string): Promise<string> {
  const household = await householdIdOf(userId);
  return household ? householdKey(household) : userId;
}

export async function loadData(key: string): Promise<AppData | null> {
  const { rows } = await pool.query<{ data: AppData }>('select data from user_data where user_id = $1', [key]);
  return rows[0]?.data ?? null;
}
