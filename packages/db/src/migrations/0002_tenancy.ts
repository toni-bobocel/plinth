import { type Kysely, sql } from 'kysely'

// Isolation is enforced by Postgres, not by remembering a `where org_id = ?`.
// The API connects as `plinth_app`, which owns nothing and is subject to RLS;
// each request sets `app.org_id` / `app.user_id` with transaction scope.
// An unset setting yields NULL, so a forgotten `withTenant` returns zero rows
// instead of another tenant's data. See docs/adr/0002-tenancy-with-rls.md.

const currentOrg = sql.raw(`nullif(current_setting('app.org_id', true), '')::uuid`)
const currentUser = sql.raw(`nullif(current_setting('app.user_id', true), '')::uuid`)

export async function up(db: Kysely<unknown>) {
  await sql`
    do $$ begin
      if not exists (select from pg_roles where rolname = 'plinth_app') then
        create role plinth_app nologin;
      end if;
    end $$
  `.execute(db)

  await sql`
    create table organizations (
      id uuid primary key default gen_random_uuid(),
      slug text not null unique check (slug ~ '^[a-z0-9](-?[a-z0-9])*$'),
      name text not null,
      created_at timestamptz not null default now()
    )
  `.execute(db)

  await sql`
    create table memberships (
      org_id uuid not null references organizations (id) on delete cascade,
      user_id uuid not null references users (id) on delete cascade,
      role text not null check (role in ('owner', 'admin', 'member')),
      created_at timestamptz not null default now(),
      primary key (org_id, user_id)
    )
  `.execute(db)
  await sql`create index memberships_user_id_idx on memberships (user_id)`.execute(db)

  await sql`
    create table projects (
      id uuid primary key default gen_random_uuid(),
      org_id uuid not null references organizations (id) on delete cascade,
      name text not null check (length(name) between 1 and 120),
      created_by uuid not null references users (id),
      created_at timestamptz not null default now(),
      unique (org_id, name)
    )
  `.execute(db)

  await sql`
    create table audit_events (
      id bigint generated always as identity primary key,
      org_id uuid not null references organizations (id) on delete cascade,
      actor_id uuid not null references users (id),
      action text not null,
      target text,
      at timestamptz not null default now()
    )
  `.execute(db)
  await sql`create index audit_events_org_at_idx on audit_events (org_id, at desc)`.execute(db)

  for (const name of ['projects', 'audit_events']) {
    const table = sql.table(name)
    await sql`alter table ${table} enable row level security`.execute(db)
    await sql`alter table ${table} force row level security`.execute(db)
    await sql`create policy tenant_isolation on ${table} using (org_id = ${currentOrg})`.execute(db)
  }

  // A user has to see their own memberships before an org is selected.
  await sql`alter table memberships enable row level security`.execute(db)
  await sql`alter table memberships force row level security`.execute(db)
  await sql`
    create policy tenant_isolation on memberships
      using (org_id = ${currentOrg} or user_id = ${currentUser})
      with check (org_id = ${currentOrg})
  `.execute(db)

  await sql`
    grant select, insert, update, delete
      on users, sessions, organizations, memberships, projects
      to plinth_app
  `.execute(db)
  // Append-only for the application: no update/delete on the audit trail.
  await sql`grant select, insert on audit_events to plinth_app`.execute(db)
}

export async function down(db: Kysely<unknown>) {
  await sql`drop table audit_events, projects, memberships, organizations`.execute(db)
}
