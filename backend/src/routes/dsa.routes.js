// DSA routes (/api/v1/dsa).
// Literal sub-paths (/tags, /stats) before /:problem_id so they aren't parsed as ids.

import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validateId } from '../middleware/validateObjectId.js'
import * as ctrl from '../controllers/dsa.controller.js'

const router = Router()
router.use(requireAuth)

// Tag catalog + tag-scoped problem list + stats — literal.
router.get('/tags', asyncHandler(ctrl.listTags))
router.get('/tags/:tag_name/problems', asyncHandler(ctrl.listProblemsForTag))
router.get('/stats', asyncHandler(ctrl.getStats))

// Problems collection.
router.get('/problems', asyncHandler(ctrl.listProblems))
router.post('/problems', asyncHandler(ctrl.createProblem))

// Per-problem.
router.get('/problems/:problem_id', validateId('problem_id'), asyncHandler(ctrl.getProblem))
router.patch('/problems/:problem_id', validateId('problem_id'), asyncHandler(ctrl.updateProblem))
router.delete('/problems/:problem_id', validateId('problem_id'), asyncHandler(ctrl.deleteProblem))

// Tag add/remove on a problem.
router.post('/problems/:problem_id/tags', validateId('problem_id'), asyncHandler(ctrl.addTagToProblem))
router.delete(
  '/problems/:problem_id/tags/:tag_name',
  validateId('problem_id'),
  asyncHandler(ctrl.removeTagFromProblem),
)

export default router
