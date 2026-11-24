import { Kysely, PostgresDialect } from 'kysely'
import pg from 'pg'
import type { DB } from './schema.js'

export function createDb(connectionString: string, max = 10) {
  return new Kysely<DB>({
    dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString, max }) }),
  })
}
