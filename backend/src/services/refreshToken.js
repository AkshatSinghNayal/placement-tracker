// Refresh-token service: issue / verify / rotate / revoke.
//
// Refresh tokens are opaque (random 32-byte urlsafe secrets). The RAW token
// is handed to the browser only via the httpOnly cookie; we persist only its
// SHA-256 hash in MongoDB (RefreshToken collection). On every refresh we
// ROTATE: revoke the old token, mint a new one — so a stolen cookie is
// useless after one legitimate refresh. Behaviour mirrors the original
// app/services/auth_service.py + core/security.py.

import RefreshToken from '../models/RefreshToken.js'
import { generateRawToken, hashToken, refreshExpiryDate } from './tokenCrypto.js'

export class RefreshTokenError extends Error {
  constructor(message) {
    super(message)
    this.name = 'RefreshTokenError'
  }
}

/**
 * Create + persist a new refresh token for a user.
 * @param {import('mongoose').Types.ObjectId|string} userId
 * @returns {Promise<{raw: string, doc: object}>}  raw = send to cookie, doc = stored hash
 */
export async function issueRefreshToken(userId) {
  const raw = generateRawToken()
  const doc = await RefreshToken.create({
    user_id: userId,
    token_hash: hashToken(raw),
    expires_at: refreshExpiryDate(),
    revoked: false,
  })
  return { raw, doc }
}

/**
 * Verify a raw refresh token and rotate it: revoke the old one, mint a new one.
 *
 * @param {string} rawToken  raw token from the cookie
 * @returns {Promise<{userId: string, newRaw: string}>}
 * @throws {RefreshTokenError} on missing / not-found / revoked / expired / user gone
 */
export async function rotateRefreshToken(rawToken) {
  if (!rawToken) throw new RefreshTokenError('missing refresh token')

  const doc = await RefreshToken.findOne({ token_hash: hashToken(rawToken) })
  if (!doc) throw new RefreshTokenError('refresh token not found')
  if (doc.revoked) throw new RefreshTokenError('refresh token revoked')

  if (doc.expires_at.getTime() <= Date.now()) {
    // Mark revoked so it can't be reused (housekeeping).
    doc.revoked = true
    await doc.save().catch(() => {})
    throw new RefreshTokenError('refresh token expired')
  }

  const userId = String(doc.user_id)

  // Rotate: revoke the old, mint a new one.
  doc.revoked = true
  await doc.save()

  const { raw: newRaw } = await issueRefreshToken(userId)
  return { userId, newRaw }
}

/** Revoke a refresh token (if present). Idempotent — no-op if cookie absent. */
export async function revokeRefreshToken(rawToken) {
  if (!rawToken) return
  const doc = await RefreshToken.findOne({ token_hash: hashToken(rawToken) })
  if (doc && !doc.revoked) {
    doc.revoked = true
    await doc.save()
  }
}

/** Revoke ALL outstanding refresh tokens for a user (used after password reset). */
export async function revokeAllForUser(userId) {
  await RefreshToken.updateMany(
    { user_id: userId, revoked: false },
    { $set: { revoked: true } },
  )
}
