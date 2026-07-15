// DSA controller. Mirrors app/services/dsa_service.py behaviour:
//   - Tags are global, case-insensitive ("Arrays" == "arrays").
//   - tag_names on create/update REPLACES the whole tag set.
//   - Setting status="Solved" sets completed_at=now; clearing it nulls completed_at.
//   - Activity log: dsa_created on POST, dsa_solved on transition to Solved.

import DsaQuestion from '../models/DsaQuestion.js'
import DsaTag from '../models/DsaTag.js'
import {
  DSA_DIFFICULTY_SET,
  DSA_PLATFORM_SET,
  DSA_STATUS_SET,
  DSA_REVISION_SET,
} from '../constants/enums.js'
import { logActivity } from '../services/activityLog.js'
import { parsePagination } from '../utils/pagination.js'
import {
  toProblemPublic,
  toTagPublic,
} from '../utils/transformers.js'
import { badRequest, notFound } from '../utils/ApiError.js'
import { requireString } from '../utils/validation.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getOwnedProblemOr404(problemId, userId) {
  const problem = await DsaQuestion.findOne({ _id: problemId, user_id: userId }).populate('tags')
  if (!problem) throw notFound('problem not found')
  return problem
}

/**
 * Resolve a list of tag names to DsaTag docs, creating missing ones.
 * Case-insensitive: first-seen casing becomes the canonical stored name.
 * @param {string[]} names
 * @returns {Promise<object[]>} array of DsaTag docs
 */
async function upsertTags(names) {
  if (!names?.length) return []

  // Normalise: strip, dedupe case-insensitively, preserve first-seen order.
  const seen = new Set()
  const normalized = []
  for (const n of names) {
    const s = (n || '').trim()
    if (!s) continue
    const key = s.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    normalized.push(s)
  }
  if (!normalized.length) return []

  const lowered = normalized.map((n) => n.toLowerCase())

  // Fetch existing (case-insensitive via collation-strength 2 unique index).
  const existing = await DsaTag.find({ name: { $in: normalized } }).collation({
    locale: 'en',
    strength: 2,
  })
  const existingByLower = new Map(existing.map((t) => [t.name.toLowerCase(), t]))

  const result = []
  const toCreate = []
  for (const orig of normalized) {
    const key = orig.toLowerCase()
    const hit = existingByLower.get(key)
    if (hit) {
      result.push(hit)
    } else {
      const tag = new DsaTag({ name: orig })
      toCreate.push(tag)
      existingByLower.set(key, tag) // reuse within same request
      result.push(tag)
    }
  }
  if (toCreate.length) {
    await DsaTag.insertMany(toCreate, { ordered: false }).catch(() => {})
    // Re-fetch in case of race / collation dedupe.
  }
  return result
}

/**
 * Replace the problem's tag set with the resolved tags for `names`.
 * @returns {Promise<object[]>} final tag docs
 */
async function setProblemTags(problem, names) {
  const tags = await upsertTags(names)
  problem.tags = tags.map((t) => t._id)
  return tags
}

/** Build {id, name} list for activity metadata. */
const tagMeta = (tags) => tags.map((t) => ({ id: String(t._id), name: t.name }))

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createProblem(req, res) {
  const body = req.body || {}
  const title = requireString(body, 'title', { min: 1, max: 255 })
  const platform = requireString(body, 'platform', { enum: DSA_PLATFORM_SET })
  const externalUrl = requireString(body, 'external_url', { min: 1, max: 2048 })
  const difficulty = requireString(body, 'difficulty', { enum: DSA_DIFFICULTY_SET })
  const status = body.status ?? 'Not Started'
  if (!DSA_STATUS_SET.has(status)) throw badRequest('invalid status')
  const revisionStatus = body.revision_status ?? 'None'
  if (!DSA_REVISION_SET.has(revisionStatus)) throw badRequest('invalid revision_status')
  if (body.notes !== undefined && body.notes !== null && typeof body.notes !== 'string') {
    throw badRequest("'notes' must be a string")
  }
  if (body.tag_names && !Array.isArray(body.tag_names)) throw badRequest("'tag_names' must be an array")

  const completedAt = status === 'Solved' ? new Date() : null

  const problem = new DsaQuestion({
    user_id: req.userId,
    title,
    platform,
    external_url: externalUrl,
    difficulty,
    status,
    revision_status: revisionStatus,
    completed_at: completedAt,
    notes: body.notes ?? null,
    tags: [],
  })
  await problem.save()

  let tags = []
  if (body.tag_names?.length) {
    tags = await setProblemTags(problem, body.tag_names)
    await problem.save()
  }

  await logActivity({
    userId: req.userId,
    action: 'dsa_created',
    entityType: 'dsa_problem',
    entityId: String(problem._id),
    metadata: {
      problem_title: problem.title,
      platform: problem.platform,
      difficulty: problem.difficulty,
      status: problem.status,
      tags: body.tag_names || [],
    },
  })

  if (status === 'Solved') {
    await logActivity({
      userId: req.userId,
      action: 'dsa_solved',
      entityType: 'dsa_problem',
      entityId: String(problem._id),
      metadata: {
        problem_title: problem.title,
        platform: problem.platform,
        difficulty: problem.difficulty,
      },
    })
  }

  await problem.populate('tags')
  return res.status(201).json(toProblemPublic(problem))
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function listProblems(req, res) {
  const { limit, offset } = parsePagination(req.query)
  const { topic, difficulty, status, platform, q } = req.query

  const filter = { user_id: req.userId }
  if (difficulty) filter.difficulty = difficulty
  if (status) filter.status = status
  if (platform) filter.platform = platform
  if (q) filter.title = { $regex: q, $options: 'i' }

  // Topic filter via tag join.
  if (topic && topic.trim()) {
    const tagDocs = await DsaTag.find({
      name: { $regex: `^${escapeRegex(topic.trim())}$`, $options: 'i' },
    })
      .collation({ locale: 'en', strength: 2 })
      .select('_id')
    const tagIds = tagDocs.map((t) => t._id)
    filter.tags = tagIds.length ? { $in: tagIds } : { $in: [] } // no match → empty
  }

  const [items, total] = await Promise.all([
    DsaQuestion.find(filter).sort({ created_at: -1 }).limit(limit).skip(offset).populate('tags'),
    DsaQuestion.countDocuments(filter),
  ])
  return res.json({ items: items.map(toProblemPublic), total, limit, offset })
}

export async function getProblem(req, res) {
  const problem = await getOwnedProblemOr404(req.params.problem_id, req.userId)
  return res.json(toProblemPublic(problem))
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateProblem(req, res) {
  const problem = await getOwnedProblemOr404(req.params.problem_id, req.userId)
  const body = req.body || {}
  const oldStatus = problem.status

  if (body.title !== undefined) problem.title = requireString(body, 'title', { min: 1, max: 255 })
  if (body.platform !== undefined) {
    if (!DSA_PLATFORM_SET.has(body.platform)) throw badRequest('invalid platform')
    problem.platform = body.platform
  }
  if (body.external_url !== undefined) {
    problem.external_url = requireString(body, 'external_url', { min: 1, max: 2048 })
  }
  if (body.difficulty !== undefined) {
    if (!DSA_DIFFICULTY_SET.has(body.difficulty)) throw badRequest('invalid difficulty')
    problem.difficulty = body.difficulty
  }
  if (body.status !== undefined) {
    if (!DSA_STATUS_SET.has(body.status)) throw badRequest('invalid status')
    problem.status = body.status
  }
  if (body.revision_status !== undefined) {
    if (!DSA_REVISION_SET.has(body.revision_status)) throw badRequest('invalid revision_status')
    problem.revision_status = body.revision_status
  }
  if (body.notes !== undefined) {
    if (body.notes !== null && typeof body.notes !== 'string') throw badRequest("'notes' must be a string")
    problem.notes = body.notes
  }

  // Status transition side-effects on completed_at.
  if (problem.status === 'Solved' && oldStatus !== 'Solved') {
    if (!problem.completed_at) problem.completed_at = new Date()
  } else if (problem.status !== 'Solved' && oldStatus === 'Solved') {
    problem.completed_at = null
  }

  let tags = null
  if (body.tag_names !== undefined) {
    if (!Array.isArray(body.tag_names)) throw badRequest("'tag_names' must be an array")
    tags = await setProblemTags(problem, body.tag_names)
  }

  await problem.save()

  // Activity logging for status transitions.
  if (problem.status === 'Solved' && oldStatus !== 'Solved') {
    await logActivity({
      userId: req.userId,
      action: 'dsa_solved',
      entityType: 'dsa_problem',
      entityId: String(problem._id),
      metadata: {
        problem_title: problem.title,
        platform: problem.platform,
        difficulty: problem.difficulty,
        previous_status: oldStatus,
      },
    })
  } else if (problem.status !== oldStatus) {
    await logActivity({
      userId: req.userId,
      action: 'dsa_status_changed',
      entityType: 'dsa_problem',
      entityId: String(problem._id),
      metadata: {
        problem_title: problem.title,
        platform: problem.platform,
        previous_status: oldStatus,
        new_status: problem.status,
      },
    })
  }

  await problem.populate('tags')
  return res.json(toProblemPublic(problem))
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteProblem(req, res) {
  const problem = await getOwnedProblemOr404(req.params.problem_id, req.userId)
  await problem.deleteOne()
  return res.status(204).send()
}

// ---------------------------------------------------------------------------
// Tag add/remove on a problem
// ---------------------------------------------------------------------------

export async function addTagToProblem(req, res) {
  const problem = await getOwnedProblemOr404(req.params.problem_id, req.userId)
  const tagName = (req.body?.name ?? '').toString().trim()
  if (!tagName) throw badRequest('tag name cannot be empty')

  await problem.populate('tags')
  const currentNames = problem.tags.map((t) => t.name)
  if (!currentNames.some((n) => n.toLowerCase() === tagName.toLowerCase())) {
    const tags = await upsertTags([...currentNames, tagName])
    problem.tags = tags.map((t) => t._id)
    await problem.save()
  }
  await problem.populate('tags')
  return res.json(toProblemPublic(problem))
}

export async function removeTagFromProblem(req, res) {
  const problem = await getOwnedProblemOr404(req.params.problem_id, req.userId)
  const tagName = (req.params.tag_name || '').trim()
  if (!tagName) throw badRequest('tag name cannot be empty')

  await problem.populate('tags')
  const keep = problem.tags.filter((t) => t.name.toLowerCase() !== tagName.toLowerCase())
  if (keep.length !== problem.tags.length) {
    problem.tags = keep.map((t) => t._id)
    await problem.save()
  }
  await problem.populate('tags')
  return res.json(toProblemPublic(problem))
}

// ---------------------------------------------------------------------------
// Tag catalog + reverse lookup
// ---------------------------------------------------------------------------

export async function listTags(req, res) {
  // Every tag + count of THIS user's problems using it (0 included).
  const pipeline = [
    {
      $lookup: {
        from: 'dsaquestions',
        localField: '_id',
        foreignField: 'tags',
        as: 'problems',
      },
    },
    {
      $addFields: {
        problem_count: {
          $size: {
            $filter: {
              input: '$problems',
              as: 'p',
              cond: { $eq: ['$$p.user_id', req.user._id] },
            },
          },
        },
      },
    },
    { $project: { name: 1, problem_count: 1 } },
    { $sort: { name: 1 } },
  ]
  const rows = await DsaTag.aggregate(pipeline)
  return res.json(rows.map((t) => toTagPublic(t, t.problem_count)))
}

export async function listProblemsForTag(req, res) {
  const { limit, offset } = parsePagination(req.query)
  const tagName = (req.params.tag_name || '').trim()
  if (!tagName) return res.json({ items: [], total: 0, limit, offset })

  const tagDocs = await DsaTag.find({ name: tagName }).collation({ locale: 'en', strength: 2 }).select('_id')
  const tagIds = tagDocs.map((t) => t._id)
  const filter = { user_id: req.userId, tags: { $in: tagIds } }

  const [items, total] = await Promise.all([
    DsaQuestion.find(filter).sort({ created_at: -1 }).limit(limit).skip(offset).populate('tags'),
    DsaQuestion.countDocuments(filter),
  ])
  return res.json({ items: items.map(toProblemPublic), total, limit, offset })
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export async function getStats(req, res) {
  const userId = req.userId

  // Difficulty-wise (always includes all three, even with 0).
  const diffAgg = await DsaQuestion.aggregate([
    { $match: { user_id: req.user._id } },
    { $group: { _id: '$difficulty', total: { $sum: 1 }, solved: { $sum: { $cond: [{ $eq: ['$status', 'Solved'] }, 1, 0] } } } },
  ])
  const diffMap = new Map(diffAgg.map((r) => [r._id, r]))
  const difficulty_wise = ['Easy', 'Medium', 'Hard'].map((d) => {
    const row = diffMap.get(d) || { total: 0, solved: 0 }
    return {
      difficulty: d,
      total: row.total,
      solved: row.solved,
      pct: row.total ? Math.round((row.solved / row.total) * 1000) / 10 : 0.0,
    }
  })

  // Topic-wise across tags linked to ANY of the user's problems.
  const topicAgg = await DsaQuestion.aggregate([
    { $match: { user_id: req.user._id } },
    { $unwind: '$tags' },
    { $group: { _id: '$tags', total: { $sum: 1 }, solved: { $sum: { $cond: [{ $eq: ['$status', 'Solved'] }, 1, 0] } } } },
    {
      $lookup: {
        from: 'dsatags',
        localField: '_id',
        foreignField: '_id',
        as: 'tag',
      },
    },
    { $unwind: '$tag' },
    { $sort: { 'tag.name': 1 } },
  ])
  const topic_wise = topicAgg.map((r) => ({
    tag: r.tag.name,
    total: r.total,
    solved: r.solved,
    pct: r.total ? Math.round((r.solved / r.total) * 1000) / 10 : 0.0,
  }))

  // Overall.
  const [overallTotal, overallSolved] = await Promise.all([
    DsaQuestion.countDocuments({ user_id: req.user._id }),
    DsaQuestion.countDocuments({ user_id: req.user._id, status: 'Solved' }),
  ])

  return res.json({
    topic_wise,
    difficulty_wise,
    overall_total: overallTotal,
    overall_solved: overallSolved,
    overall_pct: overallTotal ? Math.round((overallSolved / overallTotal) * 1000) / 10 : 0.0,
  })
}

// ---------------------------------------------------------------------------
// Small util
// ---------------------------------------------------------------------------

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
