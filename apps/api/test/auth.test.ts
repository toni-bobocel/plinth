import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { boot, type Harness } from './harness.js'

let h: Harness
beforeAll(async () => {
  h = await boot()
})
afterAll(() => h.close())

describe('auth', () => {
  it('issues a host-only, httpOnly session cookie', async () => {
    const res = await h.call('POST', '/auth/signup', {
      body: { email: 'Ada@Example.com', password: 'correct horse battery' },
    })
    expect(res.status).toBe(201)
    expect(res.body.email).toBe('ada@example.com')
    const cookie = res.headers.get('set-cookie') ?? ''
    expect(cookie).toMatch(/^__Host-plinth_session=/)
    expect(cookie).toMatch(/HttpOnly/)
    expect(cookie).toMatch(/Secure/)
    expect(cookie).toMatch(/SameSite=Lax/)
  })

  it('stores a hash of the token, never the token', async () => {
    const { cookie } = await h.signup('grace@example.com')
    const rows = await h.db.selectFrom('sessions').select('token_hash').execute()
    expect(rows.map((r) => r.token_hash)).not.toContain(cookie)
  })

  it('rejects a duplicate email with 409', async () => {
    await h.signup('linus@example.com')
    const res = await h.call('POST', '/auth/signup', {
      body: { email: 'linus@example.com', password: 'another long password' },
    })
    expect(res.status).toBe(409)
  })

  it('answers the same way for a wrong password and an unknown email', async () => {
    await h.signup('margaret@example.com')
    const wrong = await h.call('POST', '/auth/login', {
      body: { email: 'margaret@example.com', password: 'not the password!' },
    })
    const unknown = await h.call('POST', '/auth/login', {
      body: { email: 'nobody@example.com', password: 'not the password!' },
    })
    expect(wrong).toMatchObject({ status: 401, body: unknown.body })
    expect(unknown.status).toBe(401)
  })

  it('revokes the session on logout', async () => {
    const { cookie } = await h.signup('barbara@example.com')
    expect((await h.call('GET', '/auth/me', { cookie })).status).toBe(200)
    expect((await h.call('POST', '/auth/logout', { cookie })).status).toBe(204)
    expect((await h.call('GET', '/auth/me', { cookie })).status).toBe(401)
  })

  // JSON bodies already force a CORS preflight; the gap is the "simple"
  // content types a hostile page can submit with a plain <form>.
  it('refuses simple cross-origin posts carrying the session cookie', async () => {
    const { cookie } = await h.signup('dennis@example.com')
    const res = await h.app.request('http://localhost/auth/logout', {
      method: 'POST',
      headers: {
        origin: 'https://evil.example',
        'content-type': 'text/plain',
        cookie: `__Host-plinth_session=${cookie}`,
      },
      body: '',
    })
    expect(res.status).toBe(403)
    expect((await h.call('GET', '/auth/me', { cookie })).status).toBe(200)
  })
})
