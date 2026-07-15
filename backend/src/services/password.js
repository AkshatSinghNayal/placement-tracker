// Password hashing (bcryptjs — pure JS, no native build, runs fine on Render).

import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 12

/** @param {string} plain */
export async function hashPassword(plain) {
  if (!plain) throw new Error('password cannot be empty')
  const salt = await bcrypt.genSalt(SALT_ROUNDS)
  return bcrypt.hash(plain, salt)
}

/**
 * Verify a plaintext password against a stored bcrypt hash.
 * Returns false (never throws) on mismatch / malformed hash.
 * @param {string} plain
 * @param {string|null|undefined} hashed
 */
export async function verifyPassword(plain, hashed) {
  if (!plain || !hashed) return false
  try {
    return await bcrypt.compare(plain, hashed)
  } catch {
    return false
  }
}
