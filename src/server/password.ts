// Password hashing with Node's built-in scrypt, so there's no native dependency to build. Format:
//   scrypt$<N>$<r>$<p>$<salt b64>$<hash b64>
// Parameters live in the hash, so they can be raised later without invalidating existing passwords.
// No `server-only` import so the seed script and unit tests can use it too.

import { randomBytes, randomInt, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto"

const N = 16384
const R = 8
const P = 1
const KEY_LENGTH = 32

const derive = (password: string, salt: Buffer, options: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, options, (error, key) => (error ? reject(error) : resolve(key))),
  )

export async function hashPassword(password: string) {
  const salt = randomBytes(16)
  const key = await derive(password, salt, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 })
  return ["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$")
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, n, r, p, salt, hash] = stored.split("$")
  if (scheme !== "scrypt" || !n || !r || !p || !salt || !hash) return false
  const expected = Buffer.from(hash, "base64")
  const actual = await derive(password, Buffer.from(salt, "base64"), {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024,
  })
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

/** A hash to compare against when the email is unknown, so "no such user" costs the same time as "wrong password". */
export const DUMMY_HASH = "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="

// Unambiguous characters only (no 0/O, 1/l/I), since these get read out or typed from a message.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"

/** A random temporary password shown once to the super admin. */
export function generateTemporaryPassword(length = 12) {
  return Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join("")
}

export const PASSWORD_MIN_LENGTH = 8
