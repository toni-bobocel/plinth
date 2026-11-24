import { withUser } from '@plinth/db'
import { getCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import { resolveSession, SESSION_COOKIE } from '../auth/session.js'
import type { AppEnv } from '../context.js'

export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE)
  const { db, sessionTtlDays } = c.var.deps
  const user = token && (await resolveSession(db, token, sessionTtlDays))
  if (!user) throw new HTTPException(401)
  c.set('user', user)
  await next()
})

// Non-members get a 404, not a 403: org slugs are not an enumeration oracle.
export const requireMembership = createMiddleware<AppEnv>(async (c, next) => {
  const { id: userId } = c.var.user
  const slug = c.req.param('org')
  const membership =
    slug &&
    (await withUser(c.var.deps.db, userId, (trx) =>
      trx
        .selectFrom('memberships')
        .innerJoin('organizations', 'organizations.id', 'memberships.org_id')
        .select(['memberships.org_id', 'memberships.role'])
        .where('organizations.slug', '=', slug)
        .where('memberships.user_id', '=', userId)
        .executeTakeFirst(),
    ))
  if (!membership) throw new HTTPException(404)
  c.set('scope', { orgId: membership.org_id, userId })
  c.set('role', membership.role)
  await next()
})
