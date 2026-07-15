// Checklist controller. The 15 items are seeded when the user tracks a company;
// toggling an item flips is_done + completed_at and recomputes progress.

import UserCompany from '../models/UserCompany.js'
import ChecklistItem from '../models/ChecklistItem.js'
import { logActivity } from '../services/activityLog.js'
import {
  checklistProgress,
  toChecklistResponse,
} from '../utils/transformers.js'
import { badRequest, notFound } from '../utils/ApiError.js'

async function getOwnedUserCompanyOr404(userCompanyId, userId) {
  const uc = await UserCompany.findOne({ _id: userCompanyId, user_id: userId })
  if (!uc) throw notFound('checklist not found')
  return uc
}

export async function listChecklist(req, res) {
  const uc = await getOwnedUserCompanyOr404(req.params.user_company_id, req.userId)
  const items = await ChecklistItem.find({ user_company_id: uc._id }).sort({ createdAt: 1 })
  return res.json(toChecklistResponse(uc, items))
}

export async function toggleItem(req, res) {
  const uc = await getOwnedUserCompanyOr404(req.params.user_company_id, req.userId)
  const { is_done } = req.body || {}
  if (typeof is_done !== 'boolean') throw badRequest("'is_done' must be boolean")

  const item = await ChecklistItem.findOne({
    user_company_id: uc._id,
    _id: req.params.item_id,
  })
  if (!item) throw notFound('item not found')

  // Only mutate + log when the value actually changes.
  if (item.is_done !== is_done) {
    item.is_done = is_done
    item.completed_at = is_done ? new Date() : null
    await item.save()
    if (is_done) {
      await logActivity({
        userId: req.userId,
        action: 'checklist_item_completed',
        entityType: 'checklist_item',
        entityId: String(item._id),
        metadata: {
          item_key: item.item_key,
          label: item.label,
          user_company_id: String(uc._id),
        },
      })
    }
  }

  const items = await ChecklistItem.find({ user_company_id: uc._id }).sort({ createdAt: 1 })
  return res.json(toChecklistResponse(uc, items))
}

export async function bulkToggle(req, res) {
  const uc = await getOwnedUserCompanyOr404(req.params.user_company_id, req.userId)
  const updates = req.body?.updates
  if (!Array.isArray(updates)) throw badRequest("'updates' must be an array")

  const items = await ChecklistItem.find({ user_company_id: uc._id })
  const byId = new Map(items.map((i) => [String(i._id), i]))
  const now = new Date()
  const toSave = []
  const activityPayloads = []

  for (const u of updates) {
    const id = u?.item_id ? String(u.item_id) : null
    const target = id ? byId.get(id) : null
    if (!target) continue // skip unknown — don't fail the whole batch
    const next = Boolean(u.is_done)
    if (target.is_done !== next) {
      target.is_done = next
      target.completed_at = next ? now : null
      toSave.push(target)
      if (next) {
        activityPayloads.push({
          userId: req.userId,
          action: 'checklist_item_completed',
          entityType: 'checklist_item',
          entityId: String(target._id),
          metadata: {
            item_key: target.item_key,
            label: target.label,
            user_company_id: String(uc._id),
          },
        })
      }
    }
  }

  if (toSave.length) {
    await Promise.all(toSave.map((i) => i.save()))
  }
  for (const p of activityPayloads) {
    await logActivity(p)
  }

  const fresh = await ChecklistItem.find({ user_company_id: uc._id }).sort({ createdAt: 1 })
  return res.json(toChecklistResponse(uc, fresh))
}
