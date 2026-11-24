# 3. Typed SQL with Kysely, no ORM

Date: 2026-11-24
Status: accepted

## Context

The interesting parts of this codebase live in Postgres: policies, roles,
`set_config`, check constraints. An ORM that abstracts SQL away would hide
exactly what a reader needs to see, and most ORMs manage their own
connection and transaction lifecycle in ways that fight transaction-scoped
settings.

## Decision

Queries are written with Kysely, a type-safe query builder whose output is
predictable SQL. Migrations are plain SQL inside `sql` template tags,
applied in order by Kysely's migrator. The `DB` interface in
`packages/db/src/schema.ts` is maintained by hand next to the migrations.

## Consequences

- What runs is what you read. `EXPLAIN` output maps back to the source.
- The schema type and the migrations can drift. A real project should
  generate `schema.ts` with `kysely-codegen` in CI and fail on diff; it is
  left manual here to keep the template free of a database at build time.
- No lazy loading, no identity map. Fetch what you need in one query.
