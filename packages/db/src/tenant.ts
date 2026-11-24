import { type Kysely, sql, type Transaction } from 'kysely'
import type { DB } from './schema.js'

export interface TenantScope {
  orgId: string
  userId: string
}

type Work<T> = (trx: Transaction<DB>) => Promise<T>

// `is_local = true` ties the settings to the transaction, so a pooled
// connection never carries one tenant's id into its next checkout.

export function withTenant<T>(db: Kysely<DB>, scope: TenantScope, fn: Work<T>) {
  return db.transaction().execute(async (trx) => {
    await sql`select set_config('app.org_id', ${scope.orgId}, true),
                     set_config('app.user_id', ${scope.userId}, true)`.execute(trx)
    return fn(trx)
  })
}

export function withUser<T>(db: Kysely<DB>, userId: string, fn: Work<T>) {
  return db.transaction().execute(async (trx) => {
    await sql`select set_config('app.user_id', ${userId}, true)`.execute(trx)
    return fn(trx)
  })
}
