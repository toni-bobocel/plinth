import { Hono } from 'hono'
import { csrf } from 'hono/csrf'
import { HTTPException } from 'hono/http-exception'
import { requestId } from 'hono/request-id'
import { secureHeaders } from 'hono/secure-headers'
import type { AppEnv, Deps } from './context.js'
import { auth } from './routes/auth.js'
import { orgs } from './routes/orgs.js'

const UNIQUE_VIOLATION = '23505'

export function createApp(deps: Deps) {
  return new Hono<AppEnv>()
    .use(requestId(), secureHeaders(), csrf())
    .use(async (c, next) => {
      c.set('deps', deps)
      const started = performance.now()
      await next()
      deps.logger.info({
        req: c.var.requestId,
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        ms: Math.round(performance.now() - started),
      })
    })
    .get('/healthz', (c) => c.text('ok'))
    .route('/auth', auth)
    .route('/orgs', orgs)
    .onError((err, c) => {
      if (err instanceof HTTPException) {
        return c.json({ error: err.message || httpReason(err.status) }, err.status)
      }
      if (pgCode(err) === UNIQUE_VIOLATION) {
        return c.json({ error: 'already exists' }, 409)
      }
      deps.logger.error({ req: c.var.requestId, err }, 'unhandled')
      return c.json({ error: 'internal error', requestId: c.var.requestId }, 500)
    })
}

function pgCode(err: unknown) {
  return typeof err === 'object' && err !== null && 'code' in err ? err.code : undefined
}

function httpReason(status: number) {
  return { 401: 'unauthorized', 403: 'forbidden', 404: 'not found' }[status] ?? 'error'
}

export type App = ReturnType<typeof createApp>
