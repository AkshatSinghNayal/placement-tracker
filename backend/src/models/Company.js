// Company catalog row. Seeded companies (is_custom=false) are shared; custom
// companies (is_custom=true, created_by=<user>) are owned. Both are visible
// to everyone — the frontend shows Edit/Delete only when created_by === user.

import mongoose from 'mongoose'
import { COMPANY_CLUSTERS } from '../constants/enums.js'

const { Schema } = mongoose

const companySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    cluster: { type: String, required: true, enum: COMPANY_CLUSTERS },
    hiring_process: { type: String, default: null },
    oa_pattern: { type: String, default: null },
    frequent_dsa_topics: { type: [String], default: [] },
    core_cs_subjects: { type: [String], default: [] },
    resume_requirements: { type: String, default: null },
    // Arbitrary list of {title, source, summary, date} objects — kept loose.
    interview_experiences: { type: [Schema.Types.Mixed], default: [] },
    is_custom: { type: Boolean, default: false, index: true },
    created_by: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
)

companySchema.index({ cluster: 1 })
// Seeded-name partial index analogue: keeps catalog lookups by name fast.
companySchema.index({ name: 1, is_custom: 1 })

export default mongoose.model('Company', companySchema)
