// Response-shape transformers.
// The frontend's TypeScript types were generated from the old FastAPI Pydantic
// schemas, so each function here produces EXACTLY that JSON shape. Keeping the
// transforms in one module means a single place to audit contract fidelity.
//
// Convention: each `toXxx(doc)` accepts a Mongoose document (or plain object)
// and returns a plain JSON-safe object. `id` is always a string (ObjectId.toHexString).

import { CHECKLIST_ITEMS } from '../constants/checklist.js'

/** Stringify a value that may be a Date, ObjectId, or null. */
function iso(v) {
  if (!v) return null
  if (v instanceof Date) return v.toISOString()
  // Mongoose ObjectId → string
  if (typeof v === 'object' && typeof v.toHexString === 'function') return v.toHexString()
  return v
}

function num(v) {
  if (v === undefined || v === null) return 0
  return typeof v === 'number' ? v : Number(v)
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export function toUserPublic(user) {
  if (!user) return null
  return {
    id: String(user._id),
    email: user.email,
    full_name: user.full_name,
    is_active: user.is_active ?? true,
    has_google_linked: Boolean(user.google_sub),
    created_at: iso(user.createdAt),
    updated_at: iso(user.updatedAt),
  }
}

export function toTokenResponse(user, accessToken) {
  return {
    access_token: accessToken,
    token_type: 'bearer',
    user: toUserPublic(user),
  }
}

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------

export function toCompanyPublic(c) {
  if (!c) return null
  return {
    id: String(c._id),
    name: c.name,
    cluster: c.cluster,
    hiring_process: c.hiring_process ?? null,
    oa_pattern: c.oa_pattern ?? null,
    frequent_dsa_topics: Array.isArray(c.frequent_dsa_topics) ? c.frequent_dsa_topics : [],
    core_cs_subjects: Array.isArray(c.core_cs_subjects) ? c.core_cs_subjects : [],
    resume_requirements: c.resume_requirements ?? null,
    interview_experiences: Array.isArray(c.interview_experiences)
      ? c.interview_experiences
      : [],
    is_custom: c.is_custom ?? false,
    created_by: c.created_by ? String(c.created_by) : null,
    created_at: iso(c.createdAt),
    updated_at: iso(c.updatedAt),
  }
}

export function toCompanyDetail(c, userState = null) {
  const base = toCompanyPublic(c)
  base.user_state = userState
  return base
}

/**
 * Build the user_state sub-object shown on CompanyDetail.
 * @param {object} uc  UserCompany doc (or null)
 * @param {number} checklistProgressPct
 * @param {string[]} mappedResumeIds
 */
export function toUserState(uc, checklistProgressPct = 0, mappedResumeIds = []) {
  if (!uc) return null
  return {
    user_company_id: String(uc._id),
    application_status: uc.application_status,
    deadline: iso(uc.deadline),
    checklist_progress_pct: checklistProgressPct,
    mapped_resume_ids: mappedResumeIds,
  }
}

/**
 * @param {object} uc  UserCompany doc
 * @param {object} company  Company doc
 * @param {number} checklistProgressPct
 */
export function toTrackedCompany(uc, company, checklistProgressPct = 0) {
  return {
    id: String(uc._id),
    company_id: String(company._id),
    company_name: company.name,
    cluster: company.cluster,
    application_status: uc.application_status,
    deadline: iso(uc.deadline),
    notes_summary: uc.notes_summary ?? null,
    checklist_progress_pct: checklistProgressPct,
    created_at: iso(uc.createdAt),
    updated_at: iso(uc.updatedAt),
  }
}

/**
 * @param {object} uc  UserCompany doc
 * @param {object[]} items  ChecklistItem docs
 */
export function toTrackResponse(uc, items) {
  return {
    user_company_id: String(uc._id),
    company_id: String(uc.company_id),
    application_status: uc.application_status,
    deadline: iso(uc.deadline),
    checklist_items: items.map(toChecklistItemPublic),
    checklist_progress_pct: checklistProgress(items),
  }
}

// ---------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------

export function toChecklistItemPublic(i) {
  return {
    id: String(i._id),
    user_company_id: String(i.user_company_id),
    item_key: i.item_key,
    label: i.label,
    is_done: i.is_done ?? false,
    completed_at: iso(i.completed_at),
    created_at: iso(i.createdAt),
    updated_at: iso(i.updatedAt),
  }
}

export function checklistProgress(items) {
  if (!items || items.length === 0) return 0.0
  const done = items.filter((i) => i.is_done).length
  return Math.round((done / items.length) * 1000) / 10 // 1 decimal
}

/**
 * Full checklist response for a tracked company (uc + items).
 * @param {object} uc  UserCompany doc
 * @param {object[]} items  ChecklistItem docs (sorted)
 */
export function toChecklistResponse(uc, items) {
  return {
    user_company_id: String(uc._id),
    company_id: String(uc.company_id),
    application_status: uc.application_status,
    checklist_items: items.map(toChecklistItemPublic),
    checklist_progress_pct: checklistProgress(items),
  }
}

// ---------------------------------------------------------------------------
// DSA
// ---------------------------------------------------------------------------

export function toTagPublic(t, problemCount = 0) {
  return {
    id: String(t._id),
    name: t.name,
    problem_count: num(problemCount),
  }
}

/**
 * @param {object} p  DsaProblem doc with populated `.tags` (array of Tag docs)
 */
export function toProblemPublic(p) {
  return {
    id: String(p._id),
    user_id: String(p.user_id),
    title: p.title,
    platform: p.platform,
    external_url: p.external_url,
    difficulty: p.difficulty,
    status: p.status,
    revision_status: p.revision_status,
    completed_at: iso(p.completed_at),
    notes: p.notes ?? null,
    tags: Array.isArray(p.tags) ? p.tags.map((t) => toTagPublic(t)) : [],
    created_at: iso(p.createdAt),
    updated_at: iso(p.updatedAt),
  }
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export function toNotePublic(n) {
  return {
    id: String(n._id),
    user_id: String(n.user_id),
    title: n.title,
    content: n.content,
    type: n.type,
    company_id: n.company_id ? String(n.company_id) : null,
    dsa_problem_id: n.dsa_problem_id ? String(n.dsa_problem_id) : null,
    created_at: iso(n.createdAt),
    updated_at: iso(n.updatedAt),
  }
}

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

export function toResourcePublic(r) {
  return {
    id: String(r._id),
    user_id: String(r.user_id),
    company_id: r.company_id ? String(r.company_id) : null,
    title: r.title,
    url: r.url,
    category: r.category,
    description: r.description ?? null,
    created_at: iso(r.createdAt),
    updated_at: iso(r.updatedAt),
  }
}

// ---------------------------------------------------------------------------
// Resumes
// ---------------------------------------------------------------------------

export function toResumePublic(r) {
  return {
    id: String(r._id),
    user_id: String(r.user_id),
    version_label: r.version_label,
    cloudinary_url: r.cloudinary_url ?? null,
    is_active: r.is_active ?? false,
    created_at: iso(r.createdAt),
    updated_at: iso(r.updatedAt),
  }
}

export function toResumeWithScore(r, coveragePct, readinessScore) {
  return {
    ...toResumePublic(r),
    keyword_coverage_pct: coveragePct,
    readiness_score: readinessScore,
  }
}

export function toKeywordPublic(k) {
  return {
    id: String(k._id),
    resume_id: String(k.resume_id),
    keyword: k.keyword,
    is_present: k.is_present ?? false,
    created_at: iso(k.createdAt),
    updated_at: iso(k.updatedAt),
  }
}

export function toResumeCompanyMapPublic(m) {
  return {
    id: String(m._id),
    user_company_id: String(m.user_company_id),
    resume_id: String(m.resume_id),
    notes: m.notes ?? null,
    created_at: iso(m.createdAt),
    updated_at: iso(m.updatedAt),
  }
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export const toCompanyHit = (c) => ({ id: String(c._id), name: c.name, cluster: c.cluster })
export const toDsaHit = (p) => ({
  id: String(p._id),
  title: p.title,
  difficulty: p.difficulty,
  status: p.status,
})
export const toNoteHit = (n) => ({ id: String(n._id), title: n.title, type: n.type })
export const toResourceHit = (r) => ({
  id: String(r._id),
  title: r.title,
  url: r.url,
  category: r.category,
})

// ---------------------------------------------------------------------------
// Pagination envelope helper
// ---------------------------------------------------------------------------

export function paginate(items, total, limit, offset) {
  return { items, total, limit, offset }
}

export { CHECKLIST_ITEMS }
