// Activity log — append-only feed for the dashboard (recent activity, streak,
// weekly productivity, timeline). entity_id is a polymorphic string (NOT a FK)
// so the entry survives cascade-delete of the source row.

import mongoose from 'mongoose'

const { Schema } = mongoose

const activityLogSchema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: { type: String, required: true },
    entity_type: { type: String, required: true },
    entity_id: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
)

activityLogSchema.index({ user_id: 1, created_at: -1 })
activityLogSchema.index({ user_id: 1, entity_type: 1 })

export default mongoose.model('ActivityLog', activityLogSchema)
