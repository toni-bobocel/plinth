import { PGlite } from '@electric-sql/pglite'
import { type DB, migrateToLatest } from '@plinth/db'
import { Kysely, PGliteDialect, sql } from 'kysely'
import { pino } from 'pino'
import { createApp } from '../src/app.js'
import { SESSION_COOKIE } from '../src/auth/session.js'

// PGlite runs as a superuser, and superusers bypass RLS even when it is
// forced. Migrations run as the owner; the app then drops to plinth_app so
// the tests exercise the same policies production does.
export async function boot() {
  const pglite = new PGlite()
  const db = new Kysely<DB>({ dialect: new PGliteDialect({ pglite }) })
  await migrateToLatest(db)
  await sql`set role plinth_app`.execute(db)

  const app = createApp({ db, logger: pino({ level: 'silent' }), sessionTtlDays: 30 })

  async function call(
    method: string,
    path: string,
    opts: { body?: unknown; cookie?: string; origin?: string } = {},
  ) {
    const headers = new Headers({ origin: opts.origin ?? 'http://localhost' })
    if (opts.body !== undefined) headers.set('content-type', 'application/json')
    if (opts.cookie) headers.set('cookie', `${SESSION_COOKIE}=${opts.cookie}`)
    const res = await app.request(`http://localhost${path}`, {
      method,
      headers,
      body: opts.body === undefined ? null : JSON.stringify(opts.body),
    })
    const text = await res.text()
    return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers }
  }

  async function signup(email: string) {
    const res = await call('POST', '/auth/signup', {
      body: { email, password: 'correct horse battery' },
    })
    const cookie = res.headers.get('set-cookie')?.match(/=([^;]+)/)?.[1]
    if (res.status !== 201 || !cookie) throw new Error(`signup failed: ${res.status}`)
    return { id: res.body.id as string, cookie }
  }

  return { app, db, call, signup, close: () => db.destroy() }
}

export type Harness = Awaited<ReturnType<typeof boot>>
