// UserCompany — a user "tracking" a company. Carries the application status +
// deadline + notes summary. The 15 checklist items live in their own
// ChecklistItem collection (seeded on track).

import mongoose from 'mongoose'
import { APPLICATION_STATUSES } from '../constants/enums.js'

const { Schema } = mongoose

const userCompanySchema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    company_id: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    application_status: {
      type: String,
      required: true,
      enum: APPLICATION_STATUSES,
      default: 'Not Started',
    },
    deadline: { type: Date, default: null },
    notes_summary: { type: String, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
)

// Only one tracking row per (user, company).
userCompanySchema.index({ user_id: 1, company_id: 1 }, { unique: true })
// Dashboard: upcoming deadlines, filter by status.
userCompanySchema.index({ user_id: 1, deadline: 1 })
userCompanySchema.index({ user_id: 1, application_status: 1 })

export default mongoose.model('UserCompany', userCompanySchema)
