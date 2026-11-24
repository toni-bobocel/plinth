import { zValidator } from '@hono/zod-validator'
import { type DB, type TenantScope, withTenant, withUser } from '@plinth/db'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { sql, type Transaction } from 'kysely'
import { z } from 'zod'
import type { AppEnv } from '../context.js'
import { requireMembership, requireUser } from '../middleware/auth.js'

const slug = z
  .string()
  .min(2)
  .max(48)
  .regex(/^[a-z0-9](-?[a-z0-9])*$/)

const newOrg = z.object({ slug, name: z.string().trim().min(1).max(120) })
const newProject = z.object({ name: z.string().trim().min(1).max(120) })
const newMember = z.object({
  email: z.email().transform((e) => e.toLowerCase()),
  role: z.enum(['admin', 'member']),
})
const page = z.object({
  before: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

function audit(trx: Transaction<DB>, scope: TenantScope, action: string, target: string | null) {
  return trx
    .insertInto('audit_events')
    .values({ org_id: scope.orgId, actor_id: scope.userId, action, target })
    .execute()
}

const tenant = new Hono<AppEnv>()
  .use(requireMembership)
  .get('/projects', (c) =>
    withTenant(c.var.deps.db, c.var.scope, (trx) =>
      trx
        .selectFrom('projects')
        .select(['id', 'name', 'created_at'])
        .orderBy('created_at', 'desc')
        .execute(),
    ).then((rows) => c.json(rows)),
  )
  .post('/projects', zValidator('json', newProject), async (c) => {
    const { scope } = c.var
    const project = await withTenant(c.var.deps.db, scope, async (trx) => {
      const row = await trx
        .insertInto('projects')
        .values({ org_id: scope.orgId, name: c.req.valid('json').name, created_by: scope.userId })
        .returning(['id', 'name', 'created_at'])
        .executeTakeFirstOrThrow()
      await audit(trx, scope, 'project.created', row.id)
      return row
    })
    return c.json(project, 201)
  })
  .post('/members', zValidator('json', newMember), async (c) => {
    if (c.var.role === 'member') throw new HTTPException(403)
    const { scope } = c.var
    const { email, role } = c.req.valid('json')
    const added = await withTenant(c.var.deps.db, scope, async (trx) => {
      const user = await trx
        .selectFrom('users')
        .select('id')
        .where('email', '=', email)
        .executeTakeFirst()
      if (!user) return undefined
      await trx
        .insertInto('memberships')
        .values({ org_id: scope.orgId, user_id: user.id, role })
        .execute()
      await audit(trx, scope, 'member.added', user.id)
      return { userId: user.id, role }
    })
    if (!added) throw new HTTPException(404, { message: 'no account for that email' })
    return c.json(added, 201)
  })
  .get('/audit', zValidator('query', page), async (c) => {
    const { before, limit } = c.req.valid('query')
    const rows = await withTenant(c.var.deps.db, c.var.scope, (trx) =>
      trx
        .selectFrom('audit_events')
        .select(['id', 'actor_id', 'action', 'target', 'at'])
        .$if(before !== undefined, (q) => q.where('id', '<', String(before)))
        .orderBy('id', 'desc')
        .limit(limit)
        .execute(),
    )
    return c.json({ events: rows, next: rows.length === limit ? rows.at(-1)?.id : null })
  })

export const orgs = new Hono<AppEnv>()
  .use(requireUser)
  .get('/', (c) =>
    withUser(c.var.deps.db, c.var.user.id, (trx) =>
      trx
        .selectFrom('memberships')
        .innerJoin('organizations', 'organizations.id', 'memberships.org_id')
        .select(['organizations.slug', 'organizations.name', 'memberships.role'])
        .where('memberships.user_id', '=', c.var.user.id)
        .orderBy('organizations.name')
        .execute(),
    ).then((rows) => c.json(rows)),
  )
  .post('/', zValidator('json', newOrg), async (c) => {
    const userId = c.var.user.id
    const input = c.req.valid('json')
    const org = await c.var.deps.db.transaction().execute(async (trx) => {
      const created = await trx
        .insertInto('organizations')
        .values(input)
        .returning(['id', 'slug', 'name'])
        .executeTakeFirstOrThrow()
      // The org has no id until the insert above, so the tenant scope is
      // opened mid-transaction instead of through withTenant.
      await sql`select set_config('app.org_id', ${created.id}, true)`.execute(trx)
      const scope = { orgId: created.id, userId }
      await trx
        .insertInto('memberships')
        .values({ org_id: created.id, user_id: userId, role: 'owner' })
        .execute()
      await audit(trx, scope, 'org.created', created.id)
      return created
    })
    return c.json({ slug: org.slug, name: org.name }, 201)
  })
  .route('/:org', tenant)
