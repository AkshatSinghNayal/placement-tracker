// Company + tracking routes (/api/v1/companies).
// Order matters: literal sub-paths (tracked/list) must precede :company_id.

import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validateId } from '../middleware/validateObjectId.js'
import * as ctrl from '../controllers/companies.controller.js'

const router = Router()
router.use(requireAuth)

// List (catalog) + create — literal roots.
router.get('/', asyncHandler(ctrl.listCompanies))
router.post('/', asyncHandler(ctrl.createCompany))

// Tracked list — literal path BEFORE /:company_id so it isn't parsed as an id.
router.get('/tracked/list', asyncHandler(ctrl.listTrackedCompanies))

// Per-company.
router.get('/:company_id', validateId('company_id'), asyncHandler(ctrl.getCompany))
router.patch('/:company_id', validateId('company_id'), asyncHandler(ctrl.updateCompany))
router.delete('/:company_id', validateId('company_id'), asyncHandler(ctrl.deleteCompany))

// Tracking sub-resource.
router.post('/:company_id/track', validateId('company_id'), asyncHandler(ctrl.trackCompany))
router.patch('/:company_id/track', validateId('company_id'), asyncHandler(ctrl.updateTracking))
router.delete('/:company_id/track', validateId('company_id'), asyncHandler(ctrl.untrackCompany))

export default router
