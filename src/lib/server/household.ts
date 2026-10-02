import { randomBytes, randomUUID } from 'node:crypto';
import { pool } from './db';
import type { SessionUser } from './userData';

export interface Member {
  userId: string;
  name: string;
  email: string;
  role: 'owner' | 'member';
}

export interface Household {
  id: string;
  name: string;
  members: Member[];
}

const INVITE_DAYS = 7;
// No 0/O/1/I to avoid typos when reading the code aloud.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const householdKey = (id: string) => `household:${id}`;

export class HouseholdError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

export async function householdIdOf(userId: string): Promise<string | null> {
  const { rows } = await pool.query<{ household_id: string }>('select household_id from household_members where user_id = $1', [userId]);
  return rows[0]?.household_id ?? null;
}

export async function getHousehold(userId: string): Promise<Household | null> {
  const id = await householdIdOf(userId);
  if (!id) return null;
  const [{ rows: h }, { rows: m }] = await Promise.all([
    pool.query<{ name: string }>('select name from households where id = $1', [id]),
    pool.query<{ user_id: string; name: string; email: string; role: Member['role'] }>(
      'select user_id, name, email, role from household_members where household_id = $1 order by joined_at',
      [id],
    ),
  ]);
  return { id, name: h[0]?.name ?? 'Casa', members: m.map((r) => ({ userId: r.user_id, name: r.name, email: r.email, role: r.role })) };
}

/** Creates a household owned by `user`, starting from a copy of their personal data. */
export async function createHousehold(user: SessionUser, name: string): Promise<Household> {
  if (await householdIdOf(user.id)) throw new HouseholdError('Já fazes parte de uma conta partilhada.');
  const id = randomUUID();
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('insert into households (id, name, created_by) values ($1, $2, $3)', [id, name.trim().slice(0, 60) || 'Casa', user.id]);
    await client.query("insert into household_members (user_id, household_id, name, email, role) values ($1, $2, $3, $4, 'owner')", [user.id, id, user.name, user.email]);
    await client.query(
      `insert into user_data (user_id, data, updated_at_ms)
       select $2, data, updated_at_ms from user_data where user_id = $1`,
      [user.id, householdKey(id)],
    );
    await client.query('commit');
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
  return (await getHousehold(user.id))!;
}

export async function createInvite(user: SessionUser): Promise<{ code: string; expiresAt: string }> {
  const id = await householdIdOf(user.id);
  if (!id) throw new HouseholdError('Cria primeiro uma conta partilhada.');
  const bytes = randomBytes(8);
  const code = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
  const expires = new Date(Date.now() + INVITE_DAYS * 86_400_000);
  await pool.query('insert into household_invites (code, household_id, created_by, expires_at) values ($1, $2, $3, $4)', [code, id, user.id, expires]);
  return { code, expiresAt: expires.toISOString() };
}

export async function joinHousehold(user: SessionUser, rawCode: string): Promise<Household> {
  const code = rawCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (await householdIdOf(user.id)) throw new HouseholdError('Já fazes parte de uma conta partilhada. Sai primeiro dela.');
  const client = await pool.connect();
  try {
    await client.query('begin');
    const { rows } = await client.query<{ household_id: string; expires_at: Date; used_by: string | null }>(
      'select household_id, expires_at, used_by from household_invites where code = $1 for update',
      [code],
    );
    const invite = rows[0];
    if (!invite || invite.used_by) throw new HouseholdError('Código inválido ou já utilizado.', 404);
    if (invite.expires_at.getTime() < Date.now()) throw new HouseholdError('Este código expirou. Pede um novo.', 410);
    await client.query('insert into household_members (user_id, household_id, name, email) values ($1, $2, $3, $4)', [user.id, invite.household_id, user.name, user.email]);
    await client.query('update household_invites set used_by = $1 where code = $2', [user.id, code]);
    await client.query('commit');
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
  return (await getHousehold(user.id))!;
}

/**
 * Leaves the household. With `keepCopy`, the shared data is copied to the user's personal account;
 * otherwise their previous personal data is used again. The last member leaving deletes the household.
 */
export async function leaveHousehold(user: SessionUser, keepCopy: boolean): Promise<void> {
  const id = await householdIdOf(user.id);
  if (!id) return;
  const client = await pool.connect();
  try {
    await client.query('begin');
    if (keepCopy) {
      await client.query(
        `insert into user_data (user_id, data, updated_at_ms)
         select $1, data, (extract(epoch from now()) * 1000)::bigint from user_data where user_id = $2
         on conflict (user_id) do update set data = excluded.data, updated_at_ms = excluded.updated_at_ms`,
        [user.id, householdKey(id)],
      );
    }
    await client.query('delete from household_members where user_id = $1', [user.id]);
    const { rows } = await client.query<{ user_id: string }>('select user_id from household_members where household_id = $1 order by joined_at', [id]);
    if (!rows.length) {
      await client.query('delete from user_data where user_id = $1', [householdKey(id)]);
      await client.query('delete from households where id = $1', [id]);
    } else {
      // Someone must own it: hand it to the longest-standing member if the owner left.
      const { rows: owners } = await client.query("select 1 from household_members where household_id = $1 and role = 'owner'", [id]);
      if (!owners.length) await client.query("update household_members set role = 'owner' where user_id = $1", [rows[0].user_id]);
    }
    await client.query('commit');
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

export async function removeMember(owner: SessionUser, memberId: string): Promise<void> {
  const id = await householdIdOf(owner.id);
  const { rows } = await pool.query<{ role: string }>('select role from household_members where user_id = $1 and household_id = $2', [owner.id, id]);
  if (rows[0]?.role !== 'owner') throw new HouseholdError('Só quem criou a conta partilhada pode remover membros.', 403);
  if (memberId === owner.id) throw new HouseholdError('Para sair, usa "Sair da conta partilhada".');
  await pool.query('delete from household_members where user_id = $1 and household_id = $2', [memberId, id]);
}
