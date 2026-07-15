// Typed HTTP error. Thrown anywhere in a controller/service; the central
// errorHandler middleware turns it into { detail: <message> } with the
// correct status — matching the FastAPI error contract the frontend expects.

export class ApiError extends Error {
  /**
   * @param {number} status  HTTP status code.
   * @param {string} message  Human-readable detail (sent to client as `detail`).
   * @param {object} [extra]  Additional fields to merge into the JSON body.
   */
  constructor(status, message, extra = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.extra = extra
    this.isApiError = true
  }
}

/** Convenience factory for the common cases. */
export const badRequest = (msg, extra) => new ApiError(400, msg, extra)
export const unauthorized = (msg = 'Not authenticated', extra) => new ApiError(401, msg, extra)
export const forbidden = (msg = 'Not allowed', extra) => new ApiError(403, msg, extra)
export const notFound = (msg = 'Not found', extra) => new ApiError(404, msg, extra)
export const conflict = (msg, extra) => new ApiError(409, msg, extra)

export default ApiError
