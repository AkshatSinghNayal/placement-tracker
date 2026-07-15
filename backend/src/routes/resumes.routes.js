// Resumes routes (/api/v1/resumes). Upload uses the Multer middleware.

import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validateId } from '../middleware/validateObjectId.js'
import { uploadResumeMiddleware } from '../middleware/upload.js'
import * as ctrl from '../controllers/resumes.controller.js'

const router = Router()
router.use(requireAuth)

// Upload (multipart/form-data: fields `file` + `version_label`).
router.post('/upload', uploadResumeMiddleware, asyncHandler(ctrl.uploadResume))

// Collection.
router.get('/', asyncHandler(ctrl.listResumes))

// Per-resume actions.
router.post('/:resume_id/activate', validateId('resume_id'), asyncHandler(ctrl.activateResume))
router.delete('/:resume_id', validateId('resume_id'), asyncHandler(ctrl.deleteResume))
router.get('/:resume_id/pdf', validateId('resume_id'), asyncHandler(ctrl.getResumePdf))
router.get('/:resume_id/readiness', validateId('resume_id'), asyncHandler(ctrl.getReadiness))

// Map resume ↔ tracked company.
router.post('/:resume_id/map-company', validateId('resume_id'), asyncHandler(ctrl.mapCompany))

// Keywords.
router.get('/:resume_id/keywords', validateId('resume_id'), asyncHandler(ctrl.listKeywords))
router.post('/:resume_id/keywords', validateId('resume_id'), asyncHandler(ctrl.addKeyword))
router.patch(
  '/:resume_id/keywords/:keyword_id',
  validateId('resume_id'),
  validateId('keyword_id'),
  asyncHandler(ctrl.updateKeyword),
)
router.delete(
  '/:resume_id/keywords/:keyword_id',
  validateId('resume_id'),
  validateId('keyword_id'),
  asyncHandler(ctrl.deleteKeyword),
)

export default router
