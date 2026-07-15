// Small validation helpers used by controllers. We deliberately avoid a
// schema-validation library to keep dependencies minimal per the migration
// spec; these guards are focused + readable.

import { badRequest } from './ApiError.js'

/**
 * Require a string field on `body`, optionally with length bounds + an enum set.
 * Throws ApiError(400) on violation.
 *
 * @param {object} body
 * @param {string} key
 * @param {{required?: boolean, min?: number, max?: number, enum?: Set<string>}} [opts]
 */
export function requireString(body, key, opts = {}) {
  const { required = true, min, max, enum: enumSet } = opts
  const v = body?.[key]
  if (v === undefined || v === null || v === '') {
    if (required) throw badRequest(`'${key}' is required`)
    return undefined
  }
  if (typeof v !== 'string') throw badRequest(`'${key}' must be a string`)
  if (min !== undefined && v.length < min) throw badRequest(`'${key}' must be at least ${min} characters`)
  if (max !== undefined && v.length > max) throw badRequest(`'${key}' must be at most ${max} characters`)
  if (enumSet && !enumSet.has(v)) {
    throw badRequest(`'${key}' must be one of: ${[...enumSet].join(', ')}`)
  }
  return v
}

/**
 * Coerce a string field into an ObjectId-ref string, validating shape.
 * Returns undefined when absent and not required.
 */
export function requireObjectIdRef(body, key, { required = false } = {}) {
  const v = body?.[key]
  if (v === undefined || v === null || v === '') {
    if (required) throw badRequest(`'${key}' is required`)
    return undefined
  }
  // 24-char hex OR a 12-byte Mongo legacy id is a valid ObjectId string.
  const s = String(v)
  if (!/^[a-fA-F0-9]{24}$/.test(s)) throw badRequest(`'${key}' is not a valid id`)
  return s
}

/**
 * Validate an email shape loosely (no RFC foot-shooting). Mirrors what the
 * frontend's zod schema does.
 */
export function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/** Coerce an optional array-of-strings field, defaulting to []. */
export function requireStringArray(body, key, { maxItems } = {}) {
  const v = body?.[key]
  if (v === undefined || v === null) return undefined
  if (!Array.isArray(v)) throw badRequest(`'${key}' must be an array`)
  if (maxItems !== undefined && v.length > maxItems) {
    throw badRequest(`'${key}' must have at most ${maxItems} items`)
  }
  for (const item of v) {
    if (typeof item !== 'string') throw badRequest(`'${key}' must contain only strings`)
  }
  return v
}
