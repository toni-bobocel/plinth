# 4. Opaque server-side sessions over JWTs

Date: 2026-11-24
Status: accepted

## Context

The default in many starters is a JWT in `localStorage`. It is readable by
any script on the page, and it cannot be revoked before it expires without
a denylist, which reintroduces the server-side lookup JWTs were meant to
avoid.

## Decision

- 256-bit random token, sent in a `__Host-` cookie: `HttpOnly`, `Secure`,
  `SameSite=Lax`, path `/`, no domain. The prefix makes the browser refuse
  the cookie unless all of that holds.
- The database stores `sha256(token)` only. A leaked backup cannot be
  replayed.
- Sliding expiry, rewritten at most once a day so reads stay reads.
- Passwords use argon2id at the OWASP baseline. Unknown emails are verified
  against a decoy hash so response time does not reveal which accounts exist.
- `hono/csrf` rejects cross-origin form-encoded and `text/plain` posts.
  JSON requests from another origin already need a CORS preflight, which
  this API never grants.

## Consequences

- One indexed primary-key lookup per authenticated request. At the scale
  where that matters, put a short-TTL cache in front of `resolveSession`.
- Logout and "sign out everywhere" are a `delete`.
- The API and the web app must share a site. A third-party client needs a
  separate token flow; that is deliberately out of scope.
- Login rate limiting is not done in-process: per-instance counters are
  wrong as soon as there are two instances. It belongs to the edge (WAF or
  gateway) or to a shared store.
