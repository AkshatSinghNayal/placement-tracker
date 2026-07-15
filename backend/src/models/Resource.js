// Resource — external link a user saves (article / video / referral / etc.).

import mongoose from 'mongoose'
import { RESOURCE_CATEGORIES } from '../constants/enums.js'

const { Schema } = mongoose

const resourceSchema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    company_id: { type: Schema.Types.ObjectId, ref: 'Company', default: null, index: { sparse: true } },
    title: { type: String, required: true, trim: true },
    url: { type: String, required: true },
    category: { type: String, required: true, enum: RESOURCE_CATEGORIES },
    description: { type: String, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
)

resourceSchema.index({ user_id: 1, category: 1 })
resourceSchema.index({ user_id: 1, company_id: 1 })

export default mongoose.model('Resource', resourceSchema)
