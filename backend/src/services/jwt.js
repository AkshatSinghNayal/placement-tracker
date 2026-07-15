// Access-token JWT signing + verification.
//
// Access tokens are short-lived (default 15m). They're returned in the JSON
// body and kept in memory by the frontend; the long-lived refresh token (in
// the httpOnly cookie) handles session continuity + rotation.

import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { ApiError, unauthorized } from '../utils/ApiError.js'

/**
 * Mint a short-lived access JWT.
 *
 * Claims mirror the original FastAPI token:
 *   sub  = String(userId)
 *   type = "access"
 *   iat  = issued-at (jwt fills this automatically)
 *   exp  = JWT_EXPIRES_IN (e.g. "15m")
 *   jti  = random UUID (future revocation list)
 *
 * @param {import('mongoose').Types.ObjectId|string} userId
 */
export function createAccessToken(userId) {
  const payload = {
    sub: String(userId),
    type: 'access',
    jti: crypto.randomUUID(),
  }
  return jwt.sign(payload, env.JWT_SECRET, {
    algorithm: env.JWT_ALGORITHM,
    expiresIn: env.JWT_EXPIRES_IN,
  })
}

export class TokenExpiredError extends Error {
  constructor() {
    super('access token expired')
    this.name = 'TokenExpiredError'
    this.expired = true
  }
}

/**
 * Decode + validate an access JWT. Returns the userId string.
 *
 * Throws TokenExpiredError on expiry, ApiError(401) on any other failure
 * (bad signature, malformed, wrong `type` claim).
 *
 * @param {string} token
 * @returns {string} userId
 */
export function verifyAccessToken(token) {
  let payload
  try {
    payload = jwt.verify(token, env.JWT_SECRET, { algorithms: [env.JWT_ALGORITHM] })
  } catch (err) {
    if (err?.name === 'TokenExpiredError') throw new TokenExpiredError()
    throw unauthorized('invalid access token')
  }
  if (payload.type !== 'access') throw unauthorized('expected access token')
  if (!payload.sub) throw unauthorized('missing sub claim')
  // jwt sets exp/iat as numbers automatically.
  return payload.sub
}

/** Convenience guard for tests / introspection. */
export function isTokenExpiredError(e) {
  return e instanceof TokenExpiredError || e?.expired === true
}

export { ApiError }
