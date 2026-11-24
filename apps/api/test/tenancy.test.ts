import { withTenant } from '@plinth/db'
import { sql } from 'kysely'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { boot, type Harness } from './harness.js'

let h: Harness
let alice: { id: string; cookie: string }
let bob: { id: string; cookie: string }

beforeAll(async () => {
  h = await boot()
  alice = await h.signup('alice@acme.test')
  bob = await h.signup('bob@globex.test')
  await h.call('POST', '/orgs', { cookie: alice.cookie, body: { slug: 'acme', name: 'Acme' } })
  await h.call('POST', '/orgs', { cookie: bob.cookie, body: { slug: 'globex', name: 'Globex' } })
  await h.call('POST', '/orgs/acme/projects', { cookie: alice.cookie, body: { name: 'Rockets' } })
  await h.call('POST', '/orgs/globex/projects', { cookie: bob.cookie, body: { name: 'Doomsday' } })
})
afterAll(() => h.close())

describe('tenant isolation', () => {
  it('hides other orgs behind a 404', async () => {
    const res = await h.call('GET', '/orgs/globex/projects', { cookie: alice.cookie })
    expect(res.status).toBe(404)
  })

  it('lists only the caller’s orgs', async () => {
    const res = await h.call('GET', '/orgs', { cookie: alice.cookie })
    expect(res.body).toEqual([{ slug: 'acme', name: 'Acme', role: 'owner' }])
  })

  // The interesting case: the route layer is bypassed entirely and a query
  // runs with no filter at all. Postgres still scopes it.
  it('scopes an unfiltered query to the active tenant', async () => {
    const acme = await h.db
      .selectFrom('organizations')
      .select('id')
      .where('slug', '=', 'acme')
      .executeTakeFirstOrThrow()
    const names = await withTenant(h.db, { orgId: acme.id, userId: alice.id }, (trx) =>
      trx.selectFrom('projects').select('name').execute(),
    )
    expect(names).toEqual([{ name: 'Rockets' }])
  })

  it('returns nothing when no tenant is set', async () => {
    const rows = await h.db.selectFrom('projects').selectAll().execute()
    expect(rows).toEqual([])
  })

  it('rejects writes into another tenant', async () => {
    const [acme, globex] = await h.db
      .selectFrom('organizations')
      .select('id')
      .orderBy('slug')
      .execute()
    if (!acme || !globex) throw new Error('fixtures missing')
    const write = withTenant(h.db, { orgId: acme.id, userId: alice.id }, (trx) =>
      trx
        .insertInto('projects')
        .values({ org_id: globex.id, name: 'Smuggled', created_by: alice.id })
        .execute(),
    )
    await expect(write).rejects.toThrow(/row-level security/)
  })

  it('keeps the audit trail append-only', async () => {
    const acme = await h.db
      .selectFrom('organizations')
      .select('id')
      .where('slug', '=', 'acme')
      .executeTakeFirstOrThrow()
    const wipe = withTenant(h.db, { orgId: acme.id, userId: alice.id }, (trx) =>
      sql`delete from audit_events`.execute(trx),
    )
    await expect(wipe).rejects.toThrow(/permission denied/)
  })
})

describe('roles', () => {
  it('lets an owner add a member, and stops the member from doing the same', async () => {
    const carol = await h.signup('carol@acme.test')
    const added = await h.call('POST', '/orgs/acme/members', {
      cookie: alice.cookie,
      body: { email: 'carol@acme.test', role: 'member' },
    })
    expect(added.status).toBe(201)

    const seen = await h.call('GET', '/orgs/acme/projects', { cookie: carol.cookie })
    expect(seen.body.map((p: { name: string }) => p.name)).toEqual(['Rockets'])

    const escalation = await h.call('POST', '/orgs/acme/members', {
      cookie: carol.cookie,
      body: { email: 'bob@globex.test', role: 'admin' },
    })
    expect(escalation.status).toBe(403)
  })

  it('records who did what', async () => {
    const res = await h.call('GET', '/orgs/acme/audit', { cookie: alice.cookie })
    expect(res.body.events.map((e: { action: string }) => e.action)).toEqual([
      'member.added',
      'project.created',
      'org.created',
    ])
  })
})
