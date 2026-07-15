// Health route (/api/v1/health) — public, no auth.

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { health } from '../controllers/health.controller.js'

const router = Router()
router.get('/health', asyncHandler(health))

export default router
