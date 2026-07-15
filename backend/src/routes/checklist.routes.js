// Checklist routes (/api/v1/checklist).
// IMPORTANT: /bulk must be declared before /:item_id so the path parser
// doesn't treat "bulk" as an item_id.

import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validateId } from '../middleware/validateObjectId.js'
import * as ctrl from '../controllers/checklist.controller.js'

const router = Router()
router.use(requireAuth)

router.get('/:user_company_id', validateId('user_company_id'), asyncHandler(ctrl.listChecklist))
router.patch(
  '/:user_company_id/bulk',
  validateId('user_company_id'),
  asyncHandler(ctrl.bulkToggle),
)
router.patch(
  '/:user_company_id/:item_id',
  validateId('user_company_id'),
  validateId('item_id'),
  asyncHandler(ctrl.toggleItem),
)

export default router
