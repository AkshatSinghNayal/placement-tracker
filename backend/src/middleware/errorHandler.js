// Central error handler. Mounted last.
//
// Shapes every error into the FastAPI contract the frontend expects:
//   { "detail": "<message>" }   on most errors
//   { "detail": [{ "msg": ..., "type": ... }] }  preserved for validation-style
// The frontend's interceptor reads err.response.data.detail as a string.

import { ApiError } from '../utils/ApiError.js'
import { env } from '../config/env.js'

/**
 * Convert any thrown error to {status, body}. Exposed so controllers can
 * short-circuit a response (res.status(...).json(...)) AND so the middleware
 * below can share the exact same shaping logic.
 */
export function errorPayload(err) {
  if (err?.isApiError) {
    return { status: err.status, body: { detail: err.message, ...(err.extra || {}) } }
  }
  if (err?.name === 'ValidationError') {
    // Mongoose schema validation — surface a clean message.
    return { status: 400, body: { detail: err.message } }
  }
  if (err?.name === 'CastError') {
    return { status: 400, body: { detail: `invalid value for '${err.path}': ${err.value}` } }
  }
  if (err?.code === 11000) {
    // Duplicate-key — the original app maps this to 409 for emails / already-tracking.
    const field = Object.keys(err.keyValue || {})[0] || 'resource'
    return { status: 409, body: { detail: `${field} already exists` } }
  }
  // Unknown — leak nothing in prod, full message in dev.
  const message = env.IS_PROD ? 'internal server error' : err?.message || 'internal server error'
  return { status: 500, body: { detail: message } }
}

/**
 * Express error-handling middleware (4-arg signature).
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const { status, body } = errorPayload(err)

  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error(`[error] ${req.method} ${req.originalUrl}:`, err)
  } else if (env.APP_ENV === 'dev') {
    // eslint-disable-next-line no-console
    console.warn(`[warn] ${status} ${req.method} ${req.originalUrl}: ${err?.message}`)
  }

  res.status(status).json(body)
}

/** 404 handler for unmatched routes — also shaped like FastAPI's default. */
// eslint-disable-next-line no-unused-vars
export function notFoundHandler(req, res, next) {
  res.status(404).json({ detail: 'not found' })
}

export default errorHandler
