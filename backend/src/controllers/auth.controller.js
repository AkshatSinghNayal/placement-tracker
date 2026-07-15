// Auth controller.
//
// Session model (MUST match the frontend):
//   - Access token: SHORT-LIVED JWT, returned in the JSON body only.
//     The frontend keeps it in memory; never localStorage.
//   - Refresh token: LONG-LIVED opaque secret, in an httpOnly cookie only.
//     Rotated on every /auth/refresh (revoke old, mint new).
//
// Endpoints (all prefixed /api/v1/auth):
//   POST /signup                 -> 201 TokenResponse (+ set refresh cookie)
//   POST /login                  -> 200 TokenResponse (+ set refresh cookie)
//   POST /refresh                -> 200 TokenResponse (+ rotate refresh cookie)
//   POST /logout                 -> 200 {message}   (+ clear refresh cookie)
//   GET  /me                     -> 200 UserPublic
//   GET  /google/login           -> 302 Google consent
//   GET  /google/callback        -> 302 frontend (success/failure)
//   POST /password-reset/request -> 200 {message}   (always; no enumeration)
//   POST /password-reset/confirm -> 200 {message}

import User from '../models/User.js'
import PasswordResetToken from '../models/PasswordResetToken.js'
import { hashPassword, verifyPassword } from '../services/password.js'
import { createAccessToken } from '../services/jwt.js'
import {
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllForUser,
  RefreshTokenError,
} from '../services/refreshToken.js'
import {
  generateRawToken,
  hashToken,
  passwordResetExpiryDate,
} from '../services/tokenCrypto.js'
import { buildPasswordResetEmail, sendEmail } from '../services/emailStub.js'
import { env } from '../config/env.js'
import { setRefreshCookie, clearRefreshCookie } from '../utils/cookie.js'
import { toTokenResponse, toUserPublic } from '../utils/transformers.js'
import { badRequest, conflict, unauthorized, forbidden } from '../utils/ApiError.js'
import { isValidEmail } from '../utils/validation.js'

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Issue access + refresh tokens for a user, set the refresh cookie, return TokenResponse. */
async function issueSession(res, user) {
  const accessToken = createAccessToken(user._id)
  const { raw } = await issueRefreshToken(user._id)
  setRefreshCookie(res, raw)
  return toTokenResponse(user, accessToken)
}

// ---------------------------------------------------------------------------
// Email/password signup + login
// ---------------------------------------------------------------------------

export async function signup(req, res) {
  const { email, password, full_name } = req.body || {}

  if (!isValidEmail(email)) throw badRequest('a valid email is required')
  if (!password || password.length < 8 || password.length > 128) {
    throw badRequest('password must be 8-128 characters')
  }
  if (!full_name || full_name.length < 1 || full_name.length > 120) {
    throw badRequest('full_name must be 1-120 characters')
  }

  const existing = await User.findOne({ email: email.toLowerCase() })
  if (existing) throw conflict('email already registered')

  const user = await User.create({
    email: email.toLowerCase(),
    full_name,
    password: await hashPassword(password),
    // google_sub intentionally omitted (not null) so sparse unique index works
    is_active: true,
  })

  const body = await issueSession(res, user)
  return res.status(201).json(body)
}

export async function login(req, res) {
  const { email, password } = req.body || {}
  if (!isValidEmail(email) || !password) {
    throw unauthorized('invalid email or password')
  }

  // .select('+password') because the field is select:false by default.
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password')
  if (!user || !user.password) {
    // Same message for both branches — avoid user enumeration.
    throw unauthorized('invalid email or password')
  }
  if (!user.is_active) throw forbidden('account is inactive')

  const ok = await verifyPassword(password, user.password)
  if (!ok) throw unauthorized('invalid email or password')

  const body = await issueSession(res, user)
  return res.status(200).json(body)
}

// ---------------------------------------------------------------------------
// Refresh + logout  (cookie-driven)
// ---------------------------------------------------------------------------

export async function refresh(req, res) {
  const rawToken = req.cookies?.[env.REFRESH_COOKIE_NAME]
  try {
    const { userId, newRaw } = await rotateRefreshToken(rawToken)
    const user = await User.findById(userId)
    if (!user || !user.is_active) {
      clearRefreshCookie(res)
      throw unauthorized('not authenticated')
    }
    setRefreshCookie(res, newRaw)
    const accessToken = createAccessToken(user._id)
    return res.status(200).json(toTokenResponse(user, accessToken))
  } catch (err) {
    if (err instanceof RefreshTokenError || err.status === 401) {
      clearRefreshCookie(res)
      throw unauthorized(err.message || 'refresh failed')
    }
    throw err
  }
}

export async function logout(req, res) {
  const rawToken = req.cookies?.[env.REFRESH_COOKIE_NAME]
  await revokeRefreshToken(rawToken).catch(() => {})
  clearRefreshCookie(res)
  return res.status(200).json({ message: 'logged out' })
}

// ---------------------------------------------------------------------------
// Current user
// ---------------------------------------------------------------------------

export async function me(req, res) {
  // req.user is attached by requireAuth.
  return res.status(200).json(toUserPublic(req.user))
}

// ---------------------------------------------------------------------------
// Google OAuth (passport strategy in services/passport.js)
// ---------------------------------------------------------------------------

/**
 * Success handler — passport hands us req.user = { sub, email, name }.
 * Link/create the user, set the refresh cookie, redirect to the frontend.
 */
export async function googleCallbackSuccess(req, res) {
  try {
    const info = req.user
    if (!info?.sub || !info?.email) {
      return res.redirect(302, `${env.FRONTEND_URL}/login?error=oauth_missing_params`)
    }

    // 1. Existing google_sub → log in.
    let user = await User.findOne({ google_sub: info.sub })
    // 2. Existing email → link google_sub.
    if (!user) {
      user = await User.findOne({ email: info.email.toLowerCase() })
      if (user) {
        if (!user.is_active) {
          return res.redirect(302, `${env.FRONTEND_URL}/login?error=oauth_failed`)
        }
        user.google_sub = info.sub
        await user.save()
      }
    } else if (!user.is_active) {
      return res.redirect(302, `${env.FRONTEND_URL}/login?error=oauth_failed`)
    }

    // 3. Brand new user.
    if (!user) {
      user = await User.create({
        email: info.email.toLowerCase(),
        full_name: info.name || info.email.split('@')[0],
        // password intentionally omitted for Google-only accounts
        google_sub: info.sub,
        is_active: true,
      })
    }

    await issueSession(res, user)
    return res.redirect(302, `${env.FRONTEND_URL}/auth/google/callback?success=1`)
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[oauth] callback failed:', err)
    return res.redirect(302, `${env.FRONTEND_URL}/login?error=oauth_failed`)
  }
}



// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

export async function requestPasswordReset(req, res) {
  const { email } = req.body || {}
  // ALWAYS return 200 with the same message — no user enumeration.
  const message = 'if that email is registered, a reset link has been sent'

  if (!isValidEmail(email)) {
    // Still 200 to avoid leaking "bad email format" vs "unknown email".
    return res.status(200).json({ message })
  }

  const user = await User.findOne({ email: email.toLowerCase() })
  if (user) {
    const raw = generateRawToken()
    await PasswordResetToken.create({
      user_id: user._id,
      token_hash: hashToken(raw),
      expires_at: passwordResetExpiryDate(),
      used_at: null,
    })
    const { subject, body } = buildPasswordResetEmail(user.email, user.full_name, raw)
    sendEmail({ toEmail: user.email, subject, body })
  }

  return res.status(200).json({ message })
}

export async function confirmPasswordReset(req, res) {
  const { token, new_password } = req.body || {}
  if (!token || token.length < 10) throw badRequest('invalid or unknown reset token')
  if (!new_password || new_password.length < 8 || new_password.length > 128) {
    throw badRequest('password must be 8-128 characters')
  }

  const row = await PasswordResetToken.findOne({ token_hash: hashToken(token) })
  if (!row) throw badRequest('invalid or unknown reset token')
  if (row.used_at) throw badRequest('reset token already used')
  if (row.expires_at.getTime() <= Date.now()) throw badRequest('reset token expired')

  const user = await User.findById(row.user_id)
  if (!user) throw badRequest('invalid or unknown reset token')
  if (!user.is_active) throw forbidden('account is inactive')

  user.password = await hashPassword(new_password)
  row.used_at = new Date()
  await user.save()
  await row.save()

  // Revoke all outstanding refresh tokens (force re-login everywhere).
  await revokeAllForUser(user._id)

  return res.status(200).json({ message: 'password has been reset' })
}
