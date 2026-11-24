import { createHash, randomBytes } from 'node:crypto'
import type { DB } from '@plinth/db'
import type { Kysely } from 'kysely'

export const SESSION_COOKIE = '__Host-plinth_session'

const DAY = 86_400_000

const digest = (token: string) => createHash('sha256').update(token).digest('base64url')

export async function openSession(db: Kysely<DB>, userId: string, ttlDays: number) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + ttlDays * DAY)
  await db
    .insertInto('sessions')
    .values({ token_hash: digest(token), user_id: userId, expires_at: expiresAt })
    .execute()
  return { token, expiresAt }
}

// Sliding expiry, but only rewritten once a day: an authenticated read
// shouldn't turn into a write on every request.
export async function resolveSession(db: Kysely<DB>, token: string, ttlDays: number) {
  const tokenHash = digest(token)
  const row = await db
    .selectFrom('sessions')
    .innerJoin('users', 'users.id', 'sessions.user_id')
    .select(['users.id', 'users.email', 'sessions.expires_at'])
    .where('sessions.token_hash', '=', tokenHash)
    .where('sessions.expires_at', '>', new Date())
    .executeTakeFirst()
  if (!row) return undefined

  const renewed = new Date(Date.now() + ttlDays * DAY)
  if (renewed.getTime() - row.expires_at.getTime() > DAY) {
    await db
      .updateTable('sessions')
      .set({ expires_at: renewed })
      .where('token_hash', '=', tokenHash)
      .execute()
  }
  return { id: row.id, email: row.email }
}

export async function closeSession(db: Kysely<DB>, token: string) {
  await db.deleteFrom('sessions').where('token_hash', '=', digest(token)).execute()
}
