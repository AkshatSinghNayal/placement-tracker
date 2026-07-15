// Resume keyword — used for readiness coverage scoring.

import mongoose from 'mongoose'

const { Schema } = mongoose

const resumeKeywordSchema = new Schema(
  {
    resume_id: { type: Schema.Types.ObjectId, ref: 'Resume', required: true, index: true },
    keyword: { type: String, required: true, trim: true },
    is_present: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
)

resumeKeywordSchema.index({ resume_id: 1, keyword: 1 }, { unique: true })

export default mongoose.model('ResumeKeyword', resumeKeywordSchema)
