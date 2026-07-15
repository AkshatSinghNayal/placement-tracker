// Dashboard controller. Mirrors dashboard_service.py — everything computed at
// read time, no stored aggregates.
//
// Weighting (must match exactly — the UI shows the resulting number):
//   overall_progress = dsa_pct * 0.5 + resume_score * 0.3 + checklist_pct * 0.2
//   iso_week format: "YYYY-Www" (e.g. 2026-W31)

import ActivityLog from '../models/ActivityLog.js'
import DsaQuestion from '../models/DsaQuestion.js'
import Resume from '../models/Resume.js'
import ResumeKeyword from '../models/ResumeKeyword.js'
import UserCompany from '../models/UserCompany.js'
import ChecklistItem from '../models/ChecklistItem.js'
import Company from '../models/Company.js'
import DsaTag from '../models/DsaTag.js'
import { TERMINAL_APP_STATUSES, TIMELINE_ACTIONS } from '../constants/enums.js'
import { computeReadiness, overallProgress, pct } from '../services/scoring.js'

const r1 = (n) => Math.round(n * 10) / 10

// ---------------------------------------------------------------------------
// /dashboard/summary
// ---------------------------------------------------------------------------

export async function summary(req, res) {
  const userId = req.user._id

  // DSA completion.
  const [dsaTotal, dsaSolved] = await Promise.all([
    DsaQuestion.countDocuments({ user_id: userId }),
    DsaQuestion.countDocuments({ user_id: userId, status: 'Solved' }),
  ])
  const dsaCompletionPct = pct(dsaSolved, dsaTotal)

  // Resume readiness (aggregate over ALL of the user's resumes).
  const activeResumeCount = await Resume.countDocuments({ user_id: userId, is_active: true })
  const hasActiveResume = activeResumeCount > 0
  const [kwTotal, kwPresent] = await Promise.all([
    ResumeKeyword.aggregate([
      { $match: {} },
      { $lookup: { from: 'resumes', localField: 'resume_id', foreignField: '_id', as: 'r' } },
      { $unwind: '$r' },
      { $match: { 'r.user_id': userId } },
      { $count: 'n' },
    ]),
    ResumeKeyword.aggregate([
      { $match: { is_present: true } },
      { $lookup: { from: 'resumes', localField: 'resume_id', foreignField: '_id', as: 'r' } },
      { $unwind: '$r' },
      { $match: { 'r.user_id': userId } },
      { $count: 'n' },
    ]),
  ])
  const keywordTotal = kwTotal[0]?.n || 0
  const keywordPresent = kwPresent[0]?.n || 0
  const keywordCoveragePct = pct(keywordPresent, keywordTotal)
  const resumeReadinessScore = r1(keywordCoveragePct * 0.6 + (hasActiveResume ? 40.0 : 0.0))

  // Checklist completion (across all tracked companies).
  const ucRows = await UserCompany.find({ user_id: userId }).select('_id')
  const ucIds = ucRows.map((u) => u._id)
  let checklistCompletionPct = 0.0
  if (ucIds.length) {
    const [ciTotal, ciDone] = await Promise.all([
      ChecklistItem.countDocuments({ user_company_id: { $in: ucIds } }),
      ChecklistItem.countDocuments({ user_company_id: { $in: ucIds }, is_done: true }),
    ])
    checklistCompletionPct = pct(ciDone, ciTotal)
  }

  const overall = overallProgress(dsaCompletionPct, resumeReadinessScore, checklistCompletionPct)

  // Active companies (status NOT in terminal set).
  const activeCompaniesCount = await UserCompany.countDocuments({
    user_id: userId,
    application_status: { $nin: [...TERMINAL_APP_STATUSES] },
  })

  // Upcoming deadlines (future, non-terminal, sorted asc, limit 5).
  const upcomingUcs = await UserCompany.find({
    user_id: userId,
    deadline: { $ne: null, $gt: new Date() },
    application_status: { $nin: ['Offer Received', 'Rejected'] },
  })
    .sort({ deadline: 1 })
    .limit(5)
    .populate('company_id')
  const upcomingDeadlines = await Promise.all(
    upcomingUcs.map(async (uc) => {
      const company = uc.company_id || (await Company.findById(uc.company_id))
      return {
        user_company_id: String(uc._id),
        company_id: String(uc.company_id),
        company_name: company?.name ?? null,
        deadline: uc.deadline?.toISOString() ?? null,
        application_status: uc.application_status,
      }
    }),
  )

  // Recent activity (last 10).
  const recentRows = await ActivityLog.find({ user_id: userId }).sort({ created_at: -1 }).limit(10)
  const recentActivity = recentRows.map((a) => ({
    id: String(a._id),
    action: a.action,
    entity_type: a.entity_type,
    entity_id: a.entity_id ? String(a.entity_id) : null,
    metadata: a.metadata ?? null,
    created_at: a.created_at.toISOString(),
  }))

  // Charts.
  const charts = await buildCharts(userId, ucIds)

  return res.json({
    overall_progress: overall,
    dsa_completion_pct: dsaCompletionPct,
    resume_readiness_score: resumeReadinessScore,
    checklist_completion_pct: checklistCompletionPct,
    active_companies_count: activeCompaniesCount,
    upcoming_deadlines: upcomingDeadlines,
    recent_activity: recentActivity,
    charts,
  })
}

async function buildCharts(userId, ucIds) {
  // 1) DSA solved over time (by completed_at, last 30 days).
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const solvedAgg = await DsaQuestion.aggregate([
    {
      $match: {
        user_id: userId,
        completed_at: { $ne: null, $gte: thirtyDaysAgo },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$completed_at' } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ])
  const dsa_solved_over_time = solvedAgg
    .filter((r) => r._id)
    .map((r) => ({ date: r._id, count: r.count }))

  // 2) Topic distribution: per-tag solved/total across the user's problems.
  const topicAgg = await DsaQuestion.aggregate([
    { $match: { user_id: userId } },
    { $unwind: '$tags' },
    {
      $group: {
        _id: '$tags',
        total: { $sum: 1 },
        solved: { $sum: { $cond: [{ $eq: ['$status', 'Solved'] }, 1, 0] } },
      },
    },
    { $lookup: { from: 'dsatags', localField: '_id', foreignField: '_id', as: 'tag' } },
    { $unwind: '$tag' },
    { $sort: { 'tag.name': 1 } },
  ])
  const topic_distribution = topicAgg.map((r) => ({
    tag: r.tag.name,
    solved: r.solved || 0,
    total: r.total || 0,
  }))

  // 3) Company readiness: per-tracked-company checklist %.
  let company_readiness = []
  if (ucIds.length) {
    const ucDocs = await UserCompany.find({ _id: { $in: ucIds } })
      .sort({ created_at: -1 })
      .populate('company_id')
    company_readiness = await Promise.all(
      ucDocs.map(async (uc) => {
        const [t, d] = await Promise.all([
          ChecklistItem.countDocuments({ user_company_id: uc._id }),
          ChecklistItem.countDocuments({ user_company_id: uc._id, is_done: true }),
        ])
        const company = uc.company_id || (await Company.findById(uc.company_id))
        return {
          user_company_id: String(uc._id),
          company_id: String(uc.company_id),
          company_name: company?.name ?? null,
          checklist_progress_pct: pct(d, t),
        }
      }),
    )
  }

  return { dsa_solved_over_time, topic_distribution, company_readiness }
}

// ---------------------------------------------------------------------------
// /dashboard/streak  — consecutive active days from activity_log
// ---------------------------------------------------------------------------

export async function streak(req, res) {
  const userId = req.user._id

  // Distinct YYYY-MM-DD with ≥1 activity.
  const rows = await ActivityLog.aggregate([
    { $match: { user_id: userId } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } } } },
  ])
  const activeDates = new Set(rows.map((r) => r._id).filter(Boolean))
  if (activeDates.size === 0) {
    return res.json({ current_streak: 0, longest_streak: 0, last_active_date: null, today_active: false })
  }

  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const todayActive = activeDates.has(todayStr)

  // Yesterday string (UTC).
  const yesterday = new Date(today.getTime() - 86400000)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)

  // Current streak: start from today (or yesterday as grace), walk back.
  let cursorStr = null
  if (todayActive) cursorStr = todayStr
  else if (activeDates.has(yesterdayStr)) cursorStr = yesterdayStr

  let currentStreak = 0
  if (cursorStr) {
    let cursor = new Date(cursorStr + 'T00:00:00Z')
    while (activeDates.has(cursor.toISOString().slice(0, 10))) {
      currentStreak += 1
      cursor = new Date(cursor.getTime() - 86400000)
    }
  }

  // Longest streak: sort, walk forward.
  const sorted = [...activeDates].sort()
  let longest = 0
  let run = 0
  let prev = null
  for (const s of sorted) {
    if (prev !== null) {
      const diffDays = (new Date(s) - new Date(prev)) / 86400000
      run = diffDays === 1 ? run + 1 : 1
    } else {
      run = 1
    }
    longest = Math.max(longest, run)
    prev = s
  }

  return res.json({
    current_streak: currentStreak,
    longest_streak: longest,
    last_active_date: sorted[sorted.length - 1],
    today_active: todayActive,
  })
}

// ---------------------------------------------------------------------------
// /dashboard/weekly-productivity  — ISO-week buckets
// ---------------------------------------------------------------------------

export async function weeklyProductivity(req, res) {
  let weeks = parseInt(req.query.weeks, 10)
  if (!Number.isFinite(weeks)) weeks = 12
  weeks = Math.max(1, Math.min(weeks, 52))

  const rows = await ActivityLog.aggregate([
    { $match: { user_id: req.user._id } },
    {
      $group: {
        // ISO year-week with "W" prefix → "2026-W31".
        _id: {
          $dateToString: {
            format: '%G-W%V', // %G=ISO year, %V=ISO week (01-53)
            date: '$created_at',
          },
        },
        activity_count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ])
  const all = rows.filter((r) => r._id).map((r) => ({ iso_week: r._id, activity_count: r.activity_count }))
  // Keep only the last N weeks.
  const slice = all.slice(-weeks)
  const total = slice.reduce((acc, p) => acc + p.activity_count, 0)
  return res.json({ weeks: slice, total_activities: total })
}

// ---------------------------------------------------------------------------
// /dashboard/timeline  — filtered activity feed
// ---------------------------------------------------------------------------

export async function timeline(req, res) {
  let limit = parseInt(req.query.limit, 10)
  if (!Number.isFinite(limit)) limit = 50
  limit = Math.max(1, Math.min(limit, 200))
  let offset = parseInt(req.query.offset, 10)
  if (!Number.isFinite(offset) || offset < 0) offset = 0

  const filter = {
    user_id: req.user._id,
    action: { $in: [...TIMELINE_ACTIONS] },
  }

  const [rows, total] = await Promise.all([
    ActivityLog.find(filter).sort({ created_at: -1 }).limit(limit).skip(offset),
    ActivityLog.countDocuments(filter),
  ])

  const entries = rows.map((r) => ({
    timestamp: r.created_at.toISOString(),
    event_type: r.action,
    action: r.action,
    entity_type: r.entity_type,
    entity_id: r.entity_id ? String(r.entity_id) : null,
    metadata: r.metadata ?? null,
  }))

  return res.json({ entries, total, limit, offset })
}
