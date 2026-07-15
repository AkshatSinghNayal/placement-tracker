// Activity log helper — append-only feed powering the dashboard's recent
// activity, timeline, streak, and weekly-productivity charts.
//
// Mirrors app/services/activity_log.py: NEVER update or delete rows; metadata
// carries enough display context (title, name, status) that the feed can render
// without re-querying the (possibly cascade-deleted) source row.

import ActivityLog from '../models/ActivityLog.js'

/**
 * Append an activity row.
 *
 * @param {object} args
 * @param {string} args.userId
 * @param {string} args.action           e.g. "dsa_solved", "company_status_changed"
 * @param {string} args.entityType       e.g. "dsa_problem", "company"
 * @param {string|null} [args.entityId]  source doc id (string; polymorphic — NOT a FK)
 * @param {object|null} [args.metadata]  display context
 */
export async function logActivity({ userId, action, entityType, entityId = null, metadata = null }) {
  await ActivityLog.create({
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId ? String(entityId) : null,
    metadata: metadata ?? {},
  })
}
