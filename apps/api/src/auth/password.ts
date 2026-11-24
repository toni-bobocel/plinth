import { hash, verify } from '@node-rs/argon2'

// OWASP 2024 baseline for argon2id: 19 MiB, 2 iterations, 1 lane.
const params = { memoryCost: 19_456, timeCost: 2, parallelism: 1 }

// Verified against when the email is unknown, so a login attempt costs the
// same whether or not the account exists.
const decoy = hash('plinth-timing-decoy', params)

export const hashPassword = (plain: string) => hash(plain, params)

export async function verifyPassword(stored: string | undefined, plain: string) {
  return verify(stored ?? (await decoy), plain)
}
