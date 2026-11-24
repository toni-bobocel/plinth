# 1. Record architecture decisions

Date: 2026-11-24
Status: accepted

## Context

Plinth is meant to be forked as the first commit of a new product. Whoever
inherits it will meet choices that look arbitrary out of context (why no
ORM, why RLS, why cookies) and will either keep them blindly or undo them
without knowing what they protected.

## Decision

Significant decisions are written down as short ADRs in `docs/adr`, in the
format described by Michael Nygard: context, decision, consequences. An ADR
is never edited once accepted; a later one supersedes it.

## Consequences

A decision that is not worth an ADR is probably not worth defending in a
code review either. Reversing one means writing a new record, which is the
point: the cost of changing course is paid in thinking, not in archaeology.
