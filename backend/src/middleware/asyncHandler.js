// Wrap an async controller so rejected promises route to next(err) — keeps
// route handlers free of try/catch boilerplate.

export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

export default asyncHandler
