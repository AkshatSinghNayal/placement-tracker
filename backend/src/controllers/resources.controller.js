// Resources controller. Full CRUD with type/category + company filters.

import Resource from '../models/Resource.js'
import { RESOURCE_CATEGORY_SET } from '../constants/enums.js'
import { parsePagination } from '../utils/pagination.js'
import { toResourcePublic } from '../utils/transformers.js'
import { badRequest, notFound } from '../utils/ApiError.js'
import { requireString } from '../utils/validation.js'

function buildFilter(req) {
  const filter = { user_id: req.userId }
  const { category, company_id, q } = req.query
  if (category) filter.category = category
  if (company_id) filter.company_id = company_id
  if (q) {
    const re = { $regex: q, $options: 'i' }
    filter.$or = [{ title: re }, { url: re }]
  }
  return filter
}

export async function listResources(req, res) {
  const { limit, offset } = parsePagination(req.query)
  const filter = buildFilter(req)
  const [items, total] = await Promise.all([
    Resource.find(filter).sort({ created_at: -1 }).limit(limit).skip(offset),
    Resource.countDocuments(filter),
  ])
  return res.json({ items: items.map(toResourcePublic), total, limit, offset })
}

export async function createResource(req, res) {
  const body = req.body || {}
  const title = requireString(body, 'title', { min: 1, max: 255 })
  const url = requireString(body, 'url', { min: 1, max: 2048 })
  const category = requireString(body, 'category', { enum: RESOURCE_CATEGORY_SET })

  const resource = await Resource.create({
    user_id: req.userId,
    company_id: body.company_id || null,
    title,
    url,
    category,
    description: body.description ?? null,
  })

  return res.status(201).json(toResourcePublic(resource))
}

async function getOwnedOr404(id, userId) {
  const r = await Resource.findOne({ _id: id, user_id: userId })
  if (!r) throw notFound('resource not found')
  return r
}

export async function getResource(req, res) {
  const r = await getOwnedOr404(req.params.resource_id, req.userId)
  return res.json(toResourcePublic(r))
}

export async function updateResource(req, res) {
  const r = await getOwnedOr404(req.params.resource_id, req.userId)
  const body = req.body || {}
  if (body.title !== undefined) r.title = requireString(body, 'title', { min: 1, max: 255 })
  if (body.url !== undefined) r.url = requireString(body, 'url', { min: 1, max: 2048 })
  if (body.category !== undefined) r.category = requireString(body, 'category', { enum: RESOURCE_CATEGORY_SET })
  if (body.company_id !== undefined) r.company_id = body.company_id || null
  if (body.description !== undefined) r.description = body.description
  await r.save()
  return res.json(toResourcePublic(r))
}

export async function deleteResource(req, res) {
  const r = await getOwnedOr404(req.params.resource_id, req.userId)
  await r.deleteOne()
  return res.status(204).send()
}
