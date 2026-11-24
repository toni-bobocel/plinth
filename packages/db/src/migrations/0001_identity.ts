import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>) {
  await sql`
    create table users (
      id uuid primary key default gen_random_uuid(),
      email text not null unique check (email = lower(email)),
      password_hash text not null,
      created_at timestamptz not null default now()
    )
  `.execute(db)

  // Only the SHA-256 of the session token is stored: a dump of this table
  // cannot be replayed against the API.
  await sql`
    create table sessions (
      token_hash text primary key,
      user_id uuid not null references users (id) on delete cascade,
      expires_at timestamptz not null,
      created_at timestamptz not null default now()
    )
  `.execute(db)
  await sql`create index sessions_user_id_idx on sessions (user_id)`.execute(db)
}

export async function down(db: Kysely<unknown>) {
  await sql`drop table sessions`.execute(db)
  await sql`drop table users`.execute(db)
}
