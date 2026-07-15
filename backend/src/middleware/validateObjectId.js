// Path-param ObjectId validator. Used as router param middleware so a bad
// :id returns the FastAPI-style 400 instead of letting Mongoose cast silently.

import mongoose from 'mongoose'
import { badRequest } from '../utils/ApiError.js'

/**
 * Returns Express param middleware validating that the named path param is a
 * valid ObjectId. Usage: router.get('/:id', validateId('id'), handler)
 */
export function validateId(paramName) {
  return (req, _res, next) => {
    const v = req.params[paramName]
    if (!v || !mongoose.isValidObjectId(v)) {
      return next(badRequest(`invalid id: ${paramName}`))
    }
    return next()
  }
}
