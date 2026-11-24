import type { Kysely } from 'kysely'
import { type Migration, Migrator } from 'kysely/migration'
import * as identity from './migrations/0001_identity.js'
import * as tenancy from './migrations/0002_tenancy.js'
import type { DB } from './schema.js'

const migrations: Record<string, Migration> = {
  '0001_identity': identity,
  '0002_tenancy': tenancy,
}

export async function migrateToLatest(db: Kysely<DB>) {
  const migrator = new Migrator({ db, provider: { getMigrations: async () => migrations } })
  const { error, results = [] } = await migrator.migrateToLatest()
  if (error) throw error
  return results.filter((r) => r.status === 'Success').map((r) => r.migrationName)
}
