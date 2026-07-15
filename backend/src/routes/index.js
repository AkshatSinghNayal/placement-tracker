// Route aggregator. Mounts every feature router under the /api/v1 prefix,
// matching the original FastAPI app's router structure exactly.

import { Router } from 'express'
import healthRoutes from './health.routes.js'
import authRoutes from './auth.routes.js'
import companiesRoutes from './companies.routes.js'
import checklistRoutes from './checklist.routes.js'
import dsaRoutes from './dsa.routes.js'
import notesRoutes from './notes.routes.js'
import resourcesRoutes from './resources.routes.js'
import resumesRoutes from './resumes.routes.js'
import searchRoutes from './search.routes.js'
import dashboardRoutes from './dashboard.routes.js'

const router = Router()

router.use(healthRoutes) // /api/v1/health
router.use('/auth', authRoutes)
router.use('/companies', companiesRoutes)
router.use('/checklist', checklistRoutes)
router.use('/dsa', dsaRoutes)
router.use('/notes', notesRoutes)
router.use('/resources', resourcesRoutes)
router.use('/resumes', resumesRoutes)
router.use('/search', searchRoutes)
router.use('/dashboard', dashboardRoutes)

export default router
