// Parse + clamp pagination query params. Every list endpoint returns the
// { items, total, limit, offset } envelope, so we centralise the clamping.

/**
 * @param {object} query  Express req.query (raw strings).
 * @param {{defaultLimit?: number, maxLimit?: number}} [opts]
 */
export function parsePagination(query, opts = {}) {
  const defaultLimit = opts.defaultLimit ?? 20
  const maxLimit = opts.maxLimit ?? 100

  let limit = Number.parseInt(query?.limit, 10)
  if (!Number.isFinite(limit)) limit = defaultLimit
  limit = Math.max(1, Math.min(limit, maxLimit))

  let offset = Number.parseInt(query?.offset, 10)
  if (!Number.isFinite(offset) || offset < 0) offset = 0

  return { limit, offset }
}
