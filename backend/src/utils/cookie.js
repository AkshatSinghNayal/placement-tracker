// Refresh-token cookie helpers.
//
// The refresh token lives ONLY in an httpOnly cookie — the frontend never
// sees it in JS. CORS allow-credentials + SameSite=None;Secure (in prod) is
// what lets the cookie travel cross-origin (Vercel frontend ↔ Render backend).

import { env } from '../config/env.js'

/**
 * Express res.cookie() options for the refresh-token cookie.
 * @param {number} [maxAge]  Override (e.g. 0 to clear).
 */
export function refreshCookieOptions(maxAge = env.REFRESH_COOKIE_MAX_AGE) {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAMESITE,
    path: env.REFRESH_COOKIE_PATH,
    maxAge,
  }
}

/** Set the refresh cookie on an Express response. */
export function setRefreshCookie(res, rawToken) {
  res.cookie(env.REFRESH_COOKIE_NAME, rawToken, refreshCookieOptions())
}

/** Clear the refresh cookie (logout, failed refresh). */
export function clearRefreshCookie(res) {
  res.clearCookie(env.REFRESH_COOKIE_NAME, refreshCookieOptions(0))
}
