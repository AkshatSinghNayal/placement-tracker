// Auth middleware: verify the Bearer JWT, load the user, attach to req.user.
//
// Matches the frontend's exact header format: `Authorization: Bearer <token>`.
// On failure responds with the FastAPI-style error shape:
//   { detail: "..." } + WWW-Authenticate: Bearer
// On EXPIRY only we also set `X-Token-Expired: true` so the frontend's
// interceptor knows to retry via /auth/refresh (it already detects 401, but
// this header is the faithful port of the original behaviour).

import User from '../models/User.js'
import { verifyAccessToken, TokenExpiredError } from '../services/jwt.js'
import { unauthorized } from '../utils/ApiError.js'

/**
 * Require a valid access token. Attaches req.user.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || ''
    if (!header.toLowerCase().startsWith('bearer ')) {
      throw unauthorized('not authenticated')
    }
    const token = header.slice(7).trim()
    if (!token) throw unauthorized('not authenticated')

    let userId
    try {
      userId = verifyAccessToken(token)
    } catch (err) {
      if (err instanceof TokenExpiredError) {
        res.setHeader('X-Token-Expired', 'true')
      }
      res.setHeader('WWW-Authenticate', 'Bearer')
      throw unauthorized(err instanceof TokenExpiredError ? 'access token expired' : 'invalid access token')
    }

    const user = await User.findById(userId)
    if (!user || !user.is_active) {
      res.setHeader('WWW-Authenticate', 'Bearer')
      throw unauthorized('not authenticated')
    }

    req.user = user
    req.userId = String(user._id)
    return next()
  } catch (err) {
    return next(err)
  }
}

export default requireAuth
