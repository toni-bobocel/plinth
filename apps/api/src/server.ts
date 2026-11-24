import { serve } from '@hono/node-server'
import { createDb } from '@plinth/db'
import { pino } from 'pino'
import { createApp } from './app.js'
import { loadEnv } from './env.js'

const env = loadEnv()
const logger = pino({ level: env.LOG_LEVEL })
const db = createDb(env.DATABASE_URL, env.DATABASE_POOL_MAX)

const app = createApp({ db, logger, sessionTtlDays: env.SESSION_TTL_DAYS })
const server = serve({ fetch: app.fetch, port: env.PORT }, ({ port }) =>
  logger.info({ port }, 'listening'),
)

// Stop accepting, let in-flight requests finish, then release the pool.
// Kubernetes sends SIGTERM and waits terminationGracePeriodSeconds.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    logger.info({ signal }, 'draining')
    server.close(async () => {
      await db.destroy()
      process.exit(0)
    })
  })
}
