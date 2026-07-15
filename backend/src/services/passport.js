// Google OAuth strategy (passport-google-oauth20), session-free JWT flow.
//
// Flow (matches the original FastAPI app + the React frontend contract):
//   1. Browser → GET /api/v1/auth/google/login
//        → passport.authenticate('google', { scope: ['profile','email'],
//           prompt: 'select_account' })  → 302 to Google consent.
//   2. Google → GET /api/v1/auth/google/callback?code=...
//        → passport middleware fetches the Google profile.
//   3. Our controller links/creates the user, mints a JWT + refresh token,
//      sets the httpOnly refresh cookie, and 302-redirects to:
//        ${FRONTEND_URL}/auth/google/callback?success=1   (success)
//        ${FRONTEND_URL}/login?error=<code>               (failure)
//
// The strategy verify() stashes the profile on req.user; the route controller
// turns it into a session (it does NOT call passport.serializeUser — there is
// no session store).

import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import { env } from '../config/env.js'

/**
 * Wire up the Google strategy. Called once at boot (idempotent — passport
 * guards against double-registration by name).
 */
export function setupPassport() {
  // Skip if misconfigured — the auth route will surface a clear error if a
  // user actually tries to start the flow without credentials.
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    // eslint-disable-next-line no-console
    console.warn('[passport] Google OAuth disabled — GOOGLE_CLIENT_ID/SECRET not set.')
    return
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: env.GOOGLE_OAUTH_REDIRECT_URI,
        // prompt=select_account matches the original app's UX.
        prompt: 'select_account',
      },
      // Passport calls this after exchanging the code for a profile.
      // We just hand the profile object to the route handler via done().
      (accessToken, refreshToken, profile, done) => {
        // Normalise to the shape the auth controller expects.
        const info = {
          sub: profile.id,
          email: profile.emails?.[0]?.value,
          name: profile.displayName || profile.name?.givenName || null,
        }
        if (!info.email) {
          return done(new Error('Google did not return an email'))
        }
        return done(null, info)
      },
    ),
  )
}

/** Passport instance — routes use passport.authenticate('google', …). */
export default passport
