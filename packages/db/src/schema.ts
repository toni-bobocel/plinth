import type { ColumnType, Generated, Selectable } from 'kysely'

type Timestamp = ColumnType<Date, Date | string | undefined, never>

export type Role = 'owner' | 'admin' | 'member'

export interface UserTable {
  id: Generated<string>
  email: string
  password_hash: string
  created_at: Generated<Timestamp>
}

export interface SessionTable {
  token_hash: string
  user_id: string
  expires_at: Date
  created_at: Generated<Timestamp>
}

export interface OrganizationTable {
  id: Generated<string>
  slug: string
  name: string
  created_at: Generated<Timestamp>
}

export interface MembershipTable {
  org_id: string
  user_id: string
  role: Role
  created_at: Generated<Timestamp>
}

export interface ProjectTable {
  id: Generated<string>
  org_id: string
  name: string
  created_by: string
  created_at: Generated<Timestamp>
}

export interface AuditEventTable {
  id: Generated<string>
  org_id: string
  actor_id: string
  action: string
  target: string | null
  at: Generated<Timestamp>
}

export interface DB {
  users: UserTable
  sessions: SessionTable
  organizations: OrganizationTable
  memberships: MembershipTable
  projects: ProjectTable
  audit_events: AuditEventTable
}

export type User = Selectable<UserTable>
export type Organization = Selectable<OrganizationTable>
export type Project = Selectable<ProjectTable>
export type AuditEvent = Selectable<AuditEventTable>
