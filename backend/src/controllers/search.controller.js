// Search controller — ILIKE-style across companies (global) + DSA / notes /
// resources (user-scoped). Mirrors search_service.py response shape exactly.

import Company from '../models/Company.js'
import DsaQuestion from '../models/DsaQuestion.js'
import Note from '../models/Note.js'
import Resource from '../models/Resource.js'
import {
  toCompanyHit,
  toDsaHit,
  toNoteHit,
  toResourceHit,
} from '../utils/transformers.js'
import { badRequest } from '../utils/ApiError.js'

export async function search(req, res) {
  const q = (req.query.q || '').toString()
  if (!q) throw badRequest("'q' query parameter is required")
  let limit = parseInt(req.query.limit, 10)
  if (!Number.isFinite(limit)) limit = 10
  limit = Math.max(1, Math.min(limit, 50))

  const pattern = { $regex: escapeRegex(q), $options: 'i' }

  const [companies, dsaProblems, notes, resources] = await Promise.all([
    Company.find({ name: pattern }).sort({ name: 1 }).limit(limit),
    DsaQuestion.find({ user_id: req.userId, title: pattern }).sort({ createdAt: -1 }).limit(limit),
    Note.find({ user_id: req.userId, $or: [{ title: pattern }, { content: pattern }] }).sort({ createdAt: -1 }).limit(limit),
    Resource.find({ user_id: req.userId, $or: [{ title: pattern }, { url: pattern }] }).sort({ createdAt: -1 }).limit(limit),
  ])

  return res.json({
    companies: companies.map(toCompanyHit),
    dsa_problems: dsaProblems.map(toDsaHit),
    notes: notes.map(toNoteHit),
    resources: resources.map(toResourceHit),
    total: companies.length + dsaProblems.length + notes.length + resources.length,
    q,
    limit,
  })
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
