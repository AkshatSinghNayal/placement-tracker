// Notes controller. A note can attach to a company OR a dsa_problem (XOR),
// or neither (personal note). XOR is enforced here as a 400.

import Note from '../models/Note.js'
import { NOTE_TYPE_SET } from '../constants/enums.js'
import { logActivity } from '../services/activityLog.js'
import { parsePagination } from '../utils/pagination.js'
import { toNotePublic } from '../utils/transformers.js'
import { badRequest, notFound } from '../utils/ApiError.js'
import { requireString } from '../utils/validation.js'

function validateXor(body) {
  const cid = body?.company_id
  const pid = body?.dsa_problem_id
  if (cid && pid) {
    throw badRequest('a note can attach to a company OR a dsa_problem, not both')
  }
}

function buildFilter(req) {
  const filter = { user_id: req.userId }
  const { type, company_id, dsa_problem_id, q } = req.query
  if (type) filter.type = type
  if (company_id) filter.company_id = company_id
  if (dsa_problem_id) filter.dsa_problem_id = dsa_problem_id
  if (q) {
    const re = { $regex: q, $options: 'i' }
    filter.$or = [{ title: re }, { content: re }]
  }
  return filter
}

export async function listNotes(req, res) {
  const { limit, offset } = parsePagination(req.query)
  const filter = buildFilter(req)
  const [items, total] = await Promise.all([
    Note.find(filter).sort({ createdAt: -1 }).limit(limit).skip(offset),
    Note.countDocuments(filter),
  ])
  return res.json({ items: items.map(toNotePublic), total, limit, offset })
}

export async function createNote(req, res) {
  const body = req.body || {}
  validateXor(body)
  const title = requireString(body, 'title', { min: 1, max: 255 })
  const content = requireString(body, 'content', { min: 1, max: 50000 })
  const type = requireString(body, 'type', { enum: NOTE_TYPE_SET })

  const note = await Note.create({
    user_id: req.userId,
    title,
    content,
    type,
    company_id: body.company_id || null,
    dsa_problem_id: body.dsa_problem_id || null,
  })

  await logActivity({
    userId: req.userId,
    action: 'note_created',
    entityType: 'note',
    entityId: String(note._id),
    metadata: {
      title: note.title,
      type: note.type,
      has_company: Boolean(note.company_id),
      has_dsa_problem: Boolean(note.dsa_problem_id),
    },
  })

  return res.status(201).json(toNotePublic(note))
}

async function getOwnedNoteOr404(noteId, userId) {
  const note = await Note.findOne({ _id: noteId, user_id: userId })
  if (!note) throw notFound('note not found')
  return note
}

export async function getNote(req, res) {
  const note = await getOwnedNoteOr404(req.params.note_id, req.userId)
  return res.json(toNotePublic(note))
}

export async function updateNote(req, res) {
  const note = await getOwnedNoteOr404(req.params.note_id, req.userId)
  const body = req.body || {}
  validateXor(body)

  if (body.title !== undefined) note.title = requireString(body, 'title', { min: 1, max: 255 })
  if (body.content !== undefined) note.content = requireString(body, 'content', { min: 1, max: 50000 })
  if (body.type !== undefined) note.type = requireString(body, 'type', { enum: NOTE_TYPE_SET })
  if (body.company_id !== undefined) note.company_id = body.company_id || null
  if (body.dsa_problem_id !== undefined) note.dsa_problem_id = body.dsa_problem_id || null

  await note.save()
  return res.json(toNotePublic(note))
}

export async function deleteNote(req, res) {
  const note = await getOwnedNoteOr404(req.params.note_id, req.userId)
  await note.deleteOne()
  return res.status(204).send()
}
