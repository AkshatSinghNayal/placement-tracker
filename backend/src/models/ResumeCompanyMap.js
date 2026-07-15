// Resume ↔ tracked-company mapping (which resume to use for which application).

import mongoose from 'mongoose'

const { Schema } = mongoose

const resumeCompanyMapSchema = new Schema(
  {
    user_company_id: {
      type: Schema.Types.ObjectId,
      ref: 'UserCompany',
      required: true,
      index: true,
    },
    resume_id: { type: Schema.Types.ObjectId, ref: 'Resume', required: true },
    notes: { type: String, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
)

resumeCompanyMapSchema.index({ user_company_id: 1, resume_id: 1 }, { unique: true })

export default mongoose.model('ResumeCompanyMap', resumeCompanyMapSchema)
