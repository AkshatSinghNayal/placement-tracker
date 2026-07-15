// DSA problem. User-private. Tags are a many-to-many via the `tags` array
// of ObjectId refs (simpler than a join collection for this volume).

import mongoose from 'mongoose'
import {
  DSA_DIFFICULTIES,
  DSA_PLATFORMS,
  DSA_REVISION_STATUSES,
  DSA_STATUSES,
} from '../constants/enums.js'

const { Schema } = mongoose

const dsaQuestionSchema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    platform: { type: String, required: true, enum: DSA_PLATFORMS },
    external_url: { type: String, required: true },
    difficulty: { type: String, required: true, enum: DSA_DIFFICULTIES },
    status: { type: String, required: true, enum: DSA_STATUSES, default: 'Not Started' },
    revision_status: {
      type: String,
      required: true,
      enum: DSA_REVISION_STATUSES,
      default: 'None',
    },
    completed_at: { type: Date, default: null },
    notes: { type: String, default: null },
    tags: [{ type: Schema.Types.ObjectId, ref: 'DsaTag' }],
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
)

// Mirror the original Postgres compound indexes (user_id, X).
dsaQuestionSchema.index({ user_id: 1, status: 1 })
dsaQuestionSchema.index({ user_id: 1, difficulty: 1 })
dsaQuestionSchema.index({ user_id: 1, platform: 1 })
dsaQuestionSchema.index({ user_id: 1, completed_at: 1 })

export default mongoose.model('DsaQuestion', dsaQuestionSchema)
