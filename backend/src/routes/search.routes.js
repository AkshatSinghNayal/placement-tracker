// Search routes (/api/v1/search).

import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import * as ctrl from '../controllers/search.controller.js'

const router = Router()
router.use(requireAuth)
router.get('/', asyncHandler(ctrl.search))

export default router
