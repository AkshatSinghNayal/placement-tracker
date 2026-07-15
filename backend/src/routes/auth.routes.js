// Auth routes (/api/v1/auth prefix applied by the parent router).
//
// Cookie-aware endpoints (refresh/logout) need cookieParser, mounted globally
// in server.js. The OAuth routes use passport via the shared passport instance.

import { Router } from 'express'
import passport from '../services/passport.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { requireAuth } from '../middleware/auth.js'
import * as ctrl from '../controllers/auth.controller.js'

const router = Router()

// Email / password ----------------------------------------------------------
router.post('/signup', asyncHandler(ctrl.signup))
router.post('/login', asyncHandler(ctrl.login))

// Cookie-driven session restoration -----------------------------------------
// These two are hit by the frontend's auth bootstrap + 401 interceptor.
router.post('/refresh', asyncHandler(ctrl.refresh))
router.post('/logout', asyncHandler(ctrl.logout))

// Current user (requires Bearer token) --------------------------------------
router.get('/me', requireAuth, asyncHandler(ctrl.me))

// Google OAuth (passport, session-less JWT flow) ----------------------------
// GET /google/login → 302 to Google consent.
// GET /google/callback → exchanges code, sets refresh cookie, 302 to frontend.
router.get(
  '/google/login',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account',
    session: false,
  }),
)
router.get(
  '/google/callback',
  (req, res, next) => {
    passport.authenticate('google', { session: false }, (err, user, info) => {
      if (err) {
        // eslint-disable-next-line no-console
        console.error('[oauth] passport authenticate error:', err)
        return res.redirect(`${env.FRONTEND_URL}/login?error=oauth_failed`)
      }
      if (!user) {
        // eslint-disable-next-line no-console
        console.error('[oauth] passport authenticate failed (no user):', info)
        const code = info?.message?.toLowerCase().includes('declined') ? 'oauth_declined' : 'oauth_failed'
        return res.redirect(`${env.FRONTEND_URL}/login?error=${code}`)
      }
      req.user = user
      next()
    })(req, res, next)
  },
  asyncHandler(ctrl.googleCallbackSuccess),
)

// Password reset (always 200 on request — no enumeration) -------------------
router.post('/password-reset/request', asyncHandler(ctrl.requestPasswordReset))
router.post('/password-reset/confirm', asyncHandler(ctrl.confirmPasswordReset))

export default router
