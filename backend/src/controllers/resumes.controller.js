// Resumes controller. Includes the multipart upload (Multer middleware is
// wired in the route), Cloudinary upload, and the readiness-score math.
//
// Storage strategy:
//   - If Cloudinary credentials are configured → upload to Cloudinary, store
//     cloudinary_url + cloudinary_public_id on the Resume doc.
//   - Else (local dev) → store the PDF bytes in pdf_data (BinData). GET /pdf
//     then streams the bytes directly. This keeps `docker compose up` working
//     out of the box with zero external dependencies.
//
// Readiness formula (see services/scoring.js):
//   readiness_score = coverage * 0.6 + (active ? 40 : 0)   // 0-100

import https from 'https'
import Resume from '../models/Resume.js'
import ResumeKeyword from '../models/ResumeKeyword.js'
import ResumeCompanyMap from '../models/ResumeCompanyMap.js'
import UserCompany from '../models/UserCompany.js'
import { uploadPdf, destroyFile, isCloudinaryConfigured } from '../services/cloudinary.js'
import { logActivity } from '../services/activityLog.js'
import { computeReadiness, READINESS_FORMULA } from '../services/scoring.js'
import {
  toResumePublic,
  toResumeWithScore,
  toKeywordPublic,
  toResumeCompanyMapPublic,
} from '../utils/transformers.js'
import { badRequest, notFound } from '../utils/ApiError.js'
import { requireString } from '../utils/validation.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getOwnedResumeOr404(resumeId, userId) {
  const resume = await Resume.findOne({ _id: resumeId, user_id: userId })
  if (!resume) throw notFound('resume not found')
  return resume
}

async function keywordCounts(resumeId) {
  const [total, present] = await Promise.all([
    ResumeKeyword.countDocuments({ resume_id: resumeId }),
    ResumeKeyword.countDocuments({ resume_id: resumeId, is_present: true }),
  ])
  return { total, present }
}

async function userHasActiveResume(userId) {
  const count = await Resume.countDocuments({ user_id: userId, is_active: true })
  return count > 0
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

export async function uploadResume(req, res) {
  if (!req.file) throw badRequest("'file' is required (multipart/form-data, field name 'file')")
  const versionLabel = requireString(req.body, 'version_label', { min: 1, max: 80 })

  // First resume auto-activates.
  const existingCount = await Resume.countDocuments({ user_id: req.userId })
  const isFirst = existingCount === 0

  let cloudinaryUrl = null
  let cloudinaryPublicId = null
  let pdfData = null

  if (isCloudinaryConfigured()) {
    const uploaded = await uploadPdf(req.file.buffer, req.file.originalname, { folder: 'resumes' })
    cloudinaryUrl = uploaded.secure_url
    cloudinaryPublicId = uploaded.public_id
  } else {
    // Local-dev fallback: keep the bytes.
    pdfData = req.file.buffer
  }

  const resume = await Resume.create({
    user_id: req.userId,
    version_label: versionLabel,
    cloudinary_url: cloudinaryUrl,
    cloudinary_public_id: cloudinaryPublicId,
    pdf_data: pdfData,
    is_active: isFirst,
  })

  await logActivity({
    userId: req.userId,
    action: 'resume_uploaded',
    entityType: 'resume',
    entityId: String(resume._id),
    metadata: {
      version_label: versionLabel,
      is_active: isFirst,
      filename: req.file.originalname,
    },
  })

  return res.status(201).json(toResumePublic(resume))
}

// ---------------------------------------------------------------------------
// List / activate / delete
// ---------------------------------------------------------------------------

export async function listResumes(req, res) {
  const resumes = await Resume.find({ user_id: req.userId }).sort({ created_at: -1 })
  const hasActive = resumes.some((r) => r.is_active)

  // One query per resume for keyword counts — fine at this volume.
  const out = await Promise.all(
    resumes.map(async (r) => {
      const { total, present } = await keywordCounts(r._id)
      const { coverage, score } = computeReadiness({
        keywordTotal: total,
        keywordPresent: present,
        hasActiveResume: hasActive,
      })
      return toResumeWithScore(r, coverage, score)
    }),
  )
  return res.json({ items: out })
}

export async function activateResume(req, res) {
  const resume = await getOwnedResumeOr404(req.params.resume_id, req.userId)

  // Unset all the user's other active resumes (single active per user).
  await Resume.updateMany(
    { user_id: req.userId, is_active: true, _id: { $ne: resume._id } },
    { $set: { is_active: false } },
  )
  resume.is_active = true
  await resume.save()

  await logActivity({
    userId: req.userId,
    action: 'resume_activated',
    entityType: 'resume',
    entityId: String(resume._id),
    metadata: { version_label: resume.version_label },
  })

  return res.json(toResumePublic(resume))
}

export async function deleteResume(req, res) {
  const resume = await getOwnedResumeOr404(req.params.resume_id, req.userId)
  const wasActive = resume.is_active

  // Clean up Cloudinary asset if present.
  if (resume.cloudinary_public_id) {
    await destroyFile(resume.cloudinary_public_id)
  }
  await Promise.all([
    ResumeKeyword.deleteMany({ resume_id: resume._id }),
    ResumeCompanyMap.deleteMany({ resume_id: resume._id }),
  ])
  await resume.deleteOne()

  // If we deleted the active resume, auto-activate the most recent remaining.
  if (wasActive) {
    const mostRecent = await Resume.findOne({ user_id: req.userId }).sort({ created_at: -1 })
    if (mostRecent) {
      mostRecent.is_active = true
      await mostRecent.save()
    }
  }

  return res.status(204).send()
}

// ---------------------------------------------------------------------------
// Keywords
// ---------------------------------------------------------------------------

export async function listKeywords(req, res) {
  const resume = await getOwnedResumeOr404(req.params.resume_id, req.userId)
  const items = await ResumeKeyword.find({ resume_id: resume._id }).sort({ created_at: 1 })
  return res.json(items.map(toKeywordPublic))
}

export async function addKeyword(req, res) {
  const resume = await getOwnedResumeOr404(req.params.resume_id, req.userId)
  const keyword = requireString(req.body, 'keyword', { min: 1, max: 120 })

  // Idempotent: return existing if present.
  let kw = await ResumeKeyword.findOne({ resume_id: resume._id, keyword })
  if (!kw) {
    kw = await ResumeKeyword.create({ resume_id: resume._id, keyword, is_present: false })
  }
  return res.status(201).json(toKeywordPublic(kw))
}

export async function updateKeyword(req, res) {
  await getOwnedResumeOr404(req.params.resume_id, req.userId)
  const { is_present } = req.body || {}
  if (typeof is_present !== 'boolean') throw badRequest("'is_present' must be boolean")

  const kw = await ResumeKeyword.findOne({ _id: req.params.keyword_id, resume_id: req.params.resume_id })
  if (!kw) throw notFound('keyword not found')
  kw.is_present = is_present
  await kw.save()
  return res.json(toKeywordPublic(kw))
}

export async function deleteKeyword(req, res) {
  await getOwnedResumeOr404(req.params.resume_id, req.userId)
  const kw = await ResumeKeyword.findOne({ _id: req.params.keyword_id, resume_id: req.params.resume_id })
  if (!kw) throw notFound('keyword not found')
  await kw.deleteOne()
  return res.status(204).send()
}

// ---------------------------------------------------------------------------
// Resume ↔ company mapping
// ---------------------------------------------------------------------------

export async function mapCompany(req, res) {
  const resume = await getOwnedResumeOr404(req.params.resume_id, req.userId)
  const userCompanyId = req.body?.user_company_id
  if (!userCompanyId) throw badRequest("'user_company_id' is required")
  const notes = req.body?.notes
  if (notes !== undefined && notes !== null && (typeof notes !== 'string' || notes.length > 10000)) {
    throw badRequest("'notes' must be a string of at most 10000 characters")
  }

  // Verify the user_company belongs to the user.
  const uc = await UserCompany.findOne({ _id: userCompanyId, user_id: req.userId })
  if (!uc) throw notFound('tracked company not found')

  // Idempotent: update notes if mapping exists.
  let mapping = await ResumeCompanyMap.findOne({ user_company_id: uc._id, resume_id: resume._id })
  if (mapping) {
    if (notes !== undefined) mapping.notes = notes
    await mapping.save()
  } else {
    mapping = await ResumeCompanyMap.create({
      user_company_id: uc._id,
      resume_id: resume._id,
      notes: notes ?? null,
    })
  }
  return res.status(201).json(toResumeCompanyMapPublic(mapping))
}

// ---------------------------------------------------------------------------
// Readiness + PDF serving
// ---------------------------------------------------------------------------

export async function getReadiness(req, res) {
  const resume = await getOwnedResumeOr404(req.params.resume_id, req.userId)
  const { total, present } = await keywordCounts(resume._id)
  const hasActive = await userHasActiveResume(req.userId)
  const { coverage, score } = computeReadiness({
    keywordTotal: total,
    keywordPresent: present,
    hasActiveResume: hasActive,
  })
  return res.json({
    keyword_coverage_pct: coverage,
    has_active_resume: hasActive,
    readiness_score: score,
    formula: READINESS_FORMULA,
    keyword_total: total,
    keyword_present: present,
  })
}

function fetchUrlBuffer(url, redirectsLeft = 3) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        if (redirectsLeft > 0) {
          resolve(fetchUrlBuffer(response.headers.location, redirectsLeft - 1))
        } else {
          reject(new Error('Too many redirects'))
        }
        return
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to fetch: ${response.statusCode}`))
        return
      }
      const chunks = []
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', () => resolve(Buffer.concat(chunks)))
    }).on('error', (err) => reject(err))
  })
}

/**
 * GET /resumes/:id/pdf — serve the PDF.
 *   - Cloudinary path: 302 redirect to the secure_url.
 *   - Local-storage path: stream the BinData buffer inline.
 */
export async function getResumePdf(req, res) {
  const resume = await getOwnedResumeOr404(req.params.resume_id, req.userId)

  if (resume.cloudinary_url) {
    try {
      const buffer = await fetchUrlBuffer(resume.cloudinary_url)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', 'inline')
      return res.send(buffer)
    } catch (err) {
      console.error('[cloudinary] failed to stream pdf:', err)
      return res.redirect(302, resume.cloudinary_url)
    }
  }
  if (resume.pdf_data) {
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'inline')
    return res.send(Buffer.from(resume.pdf_data))
  }
  throw notFound('resume PDF not available')
}
