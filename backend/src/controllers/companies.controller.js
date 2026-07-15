// Companies + tracking controller. Behaviour mirrors app/services/company_service.py:
//   - Seeded companies (is_custom=false) are read-only; custom companies can be
//     edited/deleted only by their owner (created_by). Other users get 404 (no leak).
//   - POST /companies/{id}/track creates a UserCompany AND seeds 15 checklist items.
//   - Checklist progress is computed at read time.

import Company from '../models/Company.js'
import UserCompany from '../models/UserCompany.js'
import ChecklistItem from '../models/ChecklistItem.js'
import ResumeCompanyMap from '../models/ResumeCompanyMap.js'
import { CHECKLIST_ITEMS } from '../constants/checklist.js'
import { CLUSTER_SET, APP_STATUS_SET } from '../constants/enums.js'
import { logActivity } from '../services/activityLog.js'
import { parsePagination } from '../utils/pagination.js'
import {
  toCompanyPublic,
  toCompanyDetail,
  toUserState,
  toTrackedCompany,
  toTrackResponse,
  checklistProgress,
} from '../utils/transformers.js'
import { badRequest, conflict, notFound, forbidden } from '../utils/ApiError.js'
import { requireString, requireStringArray } from '../utils/validation.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getCompanyOr404(id) {
  const company = await Company.findById(id)
  if (!company) throw notFound('company not found')
  return company
}

/** Ensure ownership of a custom company for mutations. */
async function getOwnedCustomCompanyOr404(companyId, userId) {
  const company = await getCompanyOr404(companyId)
  if (!company.is_custom) throw forbidden('seeded companies cannot be edited or deleted')
  if (String(company.created_by) !== String(userId)) throw notFound('company not found')
  return company
}

// ---------------------------------------------------------------------------
// Company CRUD
// ---------------------------------------------------------------------------

export async function listCompanies(req, res) {
  const { limit, offset } = parsePagination(req.query)
  const { cluster, q } = req.query
  const isCustom = req.query.is_custom

  const filter = {}
  if (cluster) filter.cluster = cluster
  if (isCustom !== undefined && isCustom !== '') filter.is_custom = isCustom === 'true'
  if (q) filter.name = { $regex: q, $options: 'i' }

  const [items, total] = await Promise.all([
    Company.find(filter).sort({ is_custom: 1, name: 1 }).limit(limit).skip(offset).lean(),
    Company.countDocuments(filter),
  ])
  return res.json({ items: items.map(toCompanyPublic), total, limit, offset })
}

export async function getCompany(req, res) {
  const company = await getCompanyOr404(req.params.company_id)
  const userId = req.userId

  const uc = await UserCompany.findOne({ user_id: userId, company_id: company._id })

  // Compute checklist progress + mapped resume ids if tracking.
  let progress = 0
  let mappedResumeIds = []
  if (uc) {
    const [ciRows, mapRows] = await Promise.all([
      ChecklistItem.find({ user_company_id: uc._id }),
      ResumeCompanyMap.find({ user_company_id: uc._id }).select('resume_id'),
    ])
    progress = checklistProgress(ciRows)
    mappedResumeIds = mapRows.map((m) => String(m.resume_id))
  }

  const userState = toUserState(uc, progress, mappedResumeIds)
  return res.json(toCompanyDetail(company, userState))
}

export async function createCompany(req, res) {
  const body = req.body || {}
  const name = requireString(body, 'name', { min: 1, max: 160 })
  const cluster = requireString(body, 'cluster', { enum: CLUSTER_SET })
  const hiringProcess = requireString(body, 'hiring_process', { required: false, max: 10000 })
  const oaPattern = requireString(body, 'oa_pattern', { required: false, max: 10000 })
  const frequentDsaTopics = requireStringArray(body, 'frequent_dsa_topics', { maxItems: 30 })
  const coreCsSubjects = requireStringArray(body, 'core_cs_subjects', { maxItems: 30 })
  const resumeRequirements = requireString(body, 'resume_requirements', { required: false, max: 10000 })
  const interviewExperiences = body.interview_experiences
  if (interviewExperiences !== undefined && !Array.isArray(interviewExperiences)) {
    throw badRequest("'interview_experiences' must be an array")
  }
  if (Array.isArray(interviewExperiences) && interviewExperiences.length > 50) {
    throw badRequest("'interview_experiences' must have at most 50 items")
  }

  const company = await Company.create({
    name,
    cluster,
    hiring_process: hiringProcess ?? null,
    oa_pattern: oaPattern ?? null,
    frequent_dsa_topics: frequentDsaTopics ?? [],
    core_cs_subjects: coreCsSubjects ?? [],
    resume_requirements: resumeRequirements ?? null,
    interview_experiences: interviewExperiences ?? [],
    is_custom: true,
    created_by: req.userId,
  })

  await logActivity({
    userId: req.userId,
    action: 'company_created',
    entityType: 'company',
    entityId: String(company._id),
    metadata: { company_name: company.name, cluster: company.cluster },
  })

  return res.status(201).json(toCompanyPublic(company))
}

export async function updateCompany(req, res) {
  const company = await getOwnedCustomCompanyOr404(req.params.company_id, req.userId)
  const body = req.body || {}

  const fields = [
    ['name', 'hiring_process', 'oa_pattern', 'resume_requirements'],
    ['cluster'],
  ].flat()
  for (const f of fields) {
    if (body[f] !== undefined) {
      if (f === 'cluster' && !CLUSTER_SET.has(body[f])) throw badRequest('invalid cluster')
      company[f] = body[f]
    }
  }
  if (body.frequent_dsa_topics !== undefined) company.frequent_dsa_topics = requireStringArray(body, 'frequent_dsa_topics', { maxItems: 30 }) ?? []
  if (body.core_cs_subjects !== undefined) company.core_cs_subjects = requireStringArray(body, 'core_cs_subjects', { maxItems: 30 }) ?? []
  if (body.interview_experiences !== undefined) {
    if (!Array.isArray(body.interview_experiences)) throw badRequest("'interview_experiences' must be an array")
    company.interview_experiences = body.interview_experiences
  }

  await company.save()
  return res.json(toCompanyPublic(company))
}

export async function deleteCompany(req, res) {
  const company = await getOwnedCustomCompanyOr404(req.params.company_id, req.userId)

  await logActivity({
    userId: req.userId,
    action: 'company_deleted',
    entityType: 'company',
    entityId: String(company._id),
    metadata: { company_name: company.name, cluster: company.cluster },
  })

  // Cascade analogue: UserCompany + its checklist items + resume mappings.
  const ucs = await UserCompany.find({ company_id: company._id }).select('_id')
  const ucIds = ucs.map((u) => u._id)
  if (ucIds.length) {
    await Promise.all([
      ChecklistItem.deleteMany({ user_company_id: { $in: ucIds } }),
      ResumeCompanyMap.deleteMany({ user_company_id: { $in: ucIds } }),
      UserCompany.deleteMany({ _id: { $in: ucIds } }),
    ])
  }
  await company.deleteOne()
  return res.status(204).send()
}

// ---------------------------------------------------------------------------
// Tracking (user_company)
// ---------------------------------------------------------------------------

export async function trackCompany(req, res) {
  const company = await getCompanyOr404(req.params.company_id)
  const body = req.body || {}
  const applicationStatus = body.application_status ?? 'Not Started'
  if (!APP_STATUS_SET.has(applicationStatus)) throw badRequest('invalid application_status')
  const deadline = body.deadline ? new Date(body.deadline) : null
  if (body.deadline && Number.isNaN(deadline?.getTime?.())) throw badRequest('invalid deadline')

  const existing = await UserCompany.findOne({ user_id: req.userId, company_id: company._id })
  if (existing) throw conflict('already tracking this company')

  const uc = await UserCompany.create({
    user_id: req.userId,
    company_id: company._id,
    application_status: applicationStatus,
    deadline,
    notes_summary: null,
  })

  // Seed 15 checklist items.
  const items = await ChecklistItem.insertMany(
    CHECKLIST_ITEMS.map(([itemKey, label]) => ({
      user_company_id: uc._id,
      item_key: itemKey,
      label,
      is_done: false,
      completed_at: null,
    })),
  )

  await logActivity({
    userId: req.userId,
    action: 'company_tracked',
    entityType: 'company',
    entityId: String(company._id),
    metadata: {
      company_name: company.name,
      cluster: company.cluster,
      application_status: applicationStatus,
    },
  })

  return res.status(201).json(toTrackResponse(uc, items))
}

export async function updateTracking(req, res) {
  const company = await getCompanyOr404(req.params.company_id)
  const uc = await UserCompany.findOne({ user_id: req.userId, company_id: company._id })
  if (!uc) throw notFound('not tracking this company')

  const body = req.body || {}
  const oldStatus = uc.application_status

  if (body.application_status !== undefined) {
    if (!APP_STATUS_SET.has(body.application_status)) throw badRequest('invalid application_status')
    uc.application_status = body.application_status
  }
  if (body.deadline !== undefined) {
    uc.deadline = body.deadline ? new Date(body.deadline) : null
  }
  if (body.notes_summary !== undefined) {
    if (typeof body.notes_summary !== 'string' || body.notes_summary.length > 10000) {
      throw badRequest("'notes_summary' must be a string of at most 10000 characters")
    }
    uc.notes_summary = body.notes_summary
  }

  await uc.save()

  if (body.application_status && body.application_status !== oldStatus) {
    await logActivity({
      userId: req.userId,
      action: 'company_status_changed',
      entityType: 'company',
      entityId: String(company._id),
      metadata: {
        company_name: company.name,
        previous_status: oldStatus,
        new_status: body.application_status,
      },
    })
  }

  const items = await ChecklistItem.find({ user_company_id: uc._id })
  return res.json(toTrackedCompany(uc, company, checklistProgress(items)))
}

export async function untrackCompany(req, res) {
  const company = await getCompanyOr404(req.params.company_id)
  const uc = await UserCompany.findOne({ user_id: req.userId, company_id: company._id })
  if (!uc) throw notFound('not tracking this company')

  await logActivity({
    userId: req.userId,
    action: 'company_untracked',
    entityType: 'company',
    entityId: String(company._id),
    metadata: { company_name: company.name },
  })

  await Promise.all([
    ChecklistItem.deleteMany({ user_company_id: uc._id }),
    ResumeCompanyMap.deleteMany({ user_company_id: uc._id }),
    uc.deleteOne(),
  ])
  return res.status(204).send()
}

export async function listTrackedCompanies(req, res) {
  const { limit, offset } = parsePagination(req.query)
  const { cluster, application_status } = req.query

  const match = { user_id: req.userId }
  if (application_status) match.application_status = application_status

  // Join via aggregation so we can filter by company.cluster too.
  const pipeline = [
    { $match: match },
    {
      $lookup: {
        from: 'companies',
        localField: 'company_id',
        foreignField: '_id',
        as: 'company',
      },
    },
    { $unwind: '$company' },
    ...(cluster ? [{ $match: { 'company.cluster': cluster } }] : []),
    { $sort: { created_at: -1 } },
    {
      $facet: {
        metadata: [{ $count: 'total' }],
        items: [{ $skip: offset }, { $limit: limit }],
      },
    },
  ]

  const [result] = await UserCompany.aggregate(pipeline)
  const rows = result?.items || []
  const total = result?.metadata?.[0]?.total || 0

  // Hydrate to Mongoose docs so transformers + checklist progress work uniformly.
  const ucIds = rows.map((r) => r._id)
  const items = await ChecklistItem.find({ user_company_id: { $in: ucIds } })
  const byUc = new Map()
  for (const i of items) {
    const k = String(i.user_company_id)
    if (!byUc.has(k)) byUc.set(k, [])
    byUc.get(k).push(i)
  }

  const out = rows.map((r) => {
    const uc = UserCompany.hydrate(r)
    const company = Company.hydrate(r.company)
    return toTrackedCompany(uc, company, checklistProgress(byUc.get(String(uc._id)) || []))
  })

  return res.json({ items: out, total, limit, offset })
}
