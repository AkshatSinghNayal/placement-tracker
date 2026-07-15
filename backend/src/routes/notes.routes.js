// Notes routes (/api/v1/notes).

import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validateId } from '../middleware/validateObjectId.js'
import * as ctrl from '../controllers/notes.controller.js'

const router = Router()
router.use(requireAuth)

router.get('/', asyncHandler(ctrl.listNotes))
router.post('/', asyncHandler(ctrl.createNote))
router.get('/:note_id', validateId('note_id'), asyncHandler(ctrl.getNote))
router.patch('/:note_id', validateId('note_id'), asyncHandler(ctrl.updateNote))
router.delete('/:note_id', validateId('note_id'), asyncHandler(ctrl.deleteNote))

export default router
