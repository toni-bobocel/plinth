import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { hashPassword, verifyPassword } from '../auth/password.js'
import { closeSession, openSession, SESSION_COOKIE } from '../auth/session.js'
import type { AppEnv } from '../context.js'
import { requireUser } from '../middleware/auth.js'

const credentials = z.object({
  email: z.email().transform((e) => e.toLowerCase()),
  password: z.string().min(12).max(256),
})

export const auth = new Hono<AppEnv>()
  .post('/signup', zValidator('json', credentials), async (c) => {
    const { db, sessionTtlDays } = c.var.deps
    const { email, password } = c.req.valid('json')
    const user = await db
      .insertInto('users')
      .values({ email, password_hash: await hashPassword(password) })
      .returning(['id', 'email'])
      .executeTakeFirstOrThrow()
    const session = await openSession(db, user.id, sessionTtlDays)
    setCookie(c, SESSION_COOKIE, session.token, cookieOptions(session.expiresAt))
    return c.json(user, 201)
  })
  .post('/login', zValidator('json', credentials), async (c) => {
    const { db, sessionTtlDays } = c.var.deps
    const { email, password } = c.req.valid('json')
    const user = await db
      .selectFrom('users')
      .select(['id', 'email', 'password_hash'])
      .where('email', '=', email)
      .executeTakeFirst()
    if (!(await verifyPassword(user?.password_hash, password)) || !user) {
      throw new HTTPException(401, { message: 'invalid credentials' })
    }
    const session = await openSession(db, user.id, sessionTtlDays)
    setCookie(c, SESSION_COOKIE, session.token, cookieOptions(session.expiresAt))
    return c.json({ id: user.id, email: user.email })
  })
  .post('/logout', async (c) => {
    const token = getCookie(c, SESSION_COOKIE)
    if (token) await closeSession(c.var.deps.db, token)
    deleteCookie(c, SESSION_COOKIE, { path: '/', secure: true })
    return c.body(null, 204)
  })
  .get('/me', requireUser, (c) => c.json(c.var.user))

function cookieOptions(expires: Date) {
  return { path: '/', httpOnly: true, secure: true, sameSite: 'Lax', expires } as const
}
