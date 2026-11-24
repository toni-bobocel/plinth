import type { DB, Role, TenantScope } from '@plinth/db'
import type { Kysely } from 'kysely'
import type { Logger } from 'pino'

export interface Deps {
  db: Kysely<DB>
  logger: Logger
  sessionTtlDays: number
}

export interface AppEnv {
  Variables: {
    deps: Deps
    user: { id: string; email: string }
    scope: TenantScope
    role: Role
  }
}
