# 2. Tenant isolation with Postgres row-level security

Date: 2026-11-24
Status: accepted

## Context

Every B2B SaaS eventually ships the same bug: a query that forgot its
`where org_id = ?`. Code review catches most of them. Not all, and the one
that slips through is a data breach, not a 500.

Three common answers:

| Model                          | Isolation          | Cost                                                                         |
| ------------------------------ | ------------------ | ---------------------------------------------------------------------------- |
| Database per tenant            | Strongest          | Migrations × N, connection pools × N, cross-tenant analytics becomes ETL     |
| Schema per tenant              | Strong             | Same migration fan-out; `search_path` tricks leak through pooled connections |
| Shared tables, `org_id` column | Weakest by default | Cheap; correctness rests on every query author                               |

## Decision

Shared tables, with the guarantee moved from the application into Postgres:

- Tenant-owned tables have `ENABLE` and `FORCE ROW LEVEL SECURITY` with a
  policy on `org_id = current_setting('app.org_id')`.
- The API connects as `plinth_app`, which owns no table, so policies always
  apply. Migrations use a separate owner role.
- `withTenant(db, scope, fn)` opens a transaction and sets `app.org_id` with
  `set_config(..., true)`. The setting is transaction-local and cannot leak
  to the next request on a pooled connection.
- An unset setting resolves to `NULL`, which matches no row. Forgetting the
  scope returns an empty list instead of everybody's data.

## Consequences

- Every tenant query runs inside a transaction. With a transaction-mode
  pooler (PgBouncer, RDS Proxy) this is the shape it wants anyway.
- Policies are invisible from TypeScript. `apps/api/test/tenancy.test.ts`
  makes them visible: it runs an unfiltered `select` and asserts it only sees
  one tenant, and it attempts a cross-tenant insert and expects Postgres to
  refuse it.
- Superusers bypass RLS even when forced. Tests drop to `plinth_app` for that
  reason; production must never connect the API as the owner.
- Moving a large tenant to its own database later stays possible: the
  `org_id` column already partitions the data.
