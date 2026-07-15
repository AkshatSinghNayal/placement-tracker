// Dashboard + analytics routes (/api/v1/dashboard).

import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import * as ctrl from '../controllers/dashboard.controller.js'

const router = Router()
router.use(requireAuth)
router.get('/summary', asyncHandler(ctrl.summary))
router.get('/streak', asyncHandler(ctrl.streak))
router.get('/weekly-productivity', asyncHandler(ctrl.weeklyProductivity))
router.get('/timeline', asyncHandler(ctrl.timeline))

export default router
