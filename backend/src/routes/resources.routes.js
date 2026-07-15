// Resources routes (/api/v1/resources).

import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validateId } from '../middleware/validateObjectId.js'
import * as ctrl from '../controllers/resources.controller.js'

const router = Router()
router.use(requireAuth)

router.get('/', asyncHandler(ctrl.listResources))
router.post('/', asyncHandler(ctrl.createResource))
router.get('/:resource_id', validateId('resource_id'), asyncHandler(ctrl.getResource))
router.patch('/:resource_id', validateId('resource_id'), asyncHandler(ctrl.updateResource))
router.delete('/:resource_id', validateId('resource_id'), asyncHandler(ctrl.deleteResource))

export default router
