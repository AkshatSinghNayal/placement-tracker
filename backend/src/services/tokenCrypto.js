// Opaque-token crypto (refresh tokens + password-reset tokens).
//
// These tokens are random 32-byte urlsafe secrets. We store them SHA-256-hashed
// in MongoDB (a stolen DB dump can't be replayed), and hand the RAW token to
// the browser only inside the httpOnly cookie.

import crypto from 'node:crypto'
import { env } from '../config/env.js'

/** Generate a 32-byte urlsafe secret (43 chars). */
export function generateRawToken() {
  return crypto.randomBytes(32).toString('base64url')
}

/** SHA-256 hex of a raw token — the form we persist. */
export function hashToken(raw) {
  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex')
}

// --- Expiry helpers ---------------------------------------------------------

export function accessExpiryDate() {
  return new Date(Date.now() + env.ACCESS_TOKEN_TTL_MINUTES * 60 * 1000)
}
export function refreshExpiryDate() {
  return new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000)
}
export function passwordResetExpiryDate() {
  return new Date(Date.now() + env.PASSWORD_RESET_TTL_MINUTES * 60 * 1000)
}
