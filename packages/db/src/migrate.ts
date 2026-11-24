import { createDb } from './client.js'
import { migrateToLatest } from './migrator.js'

const url = process.env.MIGRATION_DATABASE_URL
if (!url) {
  process.stderr.write('MIGRATION_DATABASE_URL is required (owner role, not plinth_app)\n')
  process.exit(1)
}

const db = createDb(url, 1)
const applied = await migrateToLatest(db)
process.stdout.write(applied.length ? `applied: ${applied.join(', ')}\n` : 'up to date\n')
await db.destroy()
