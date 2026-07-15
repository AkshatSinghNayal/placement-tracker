// Note. Can attach to a company OR a dsa_problem (XOR — enforced in service),
// or neither (personal note).

import mongoose from 'mongoose'
import { NOTE_TYPES } from '../constants/enums.js'

const { Schema } = mongoose

const noteSchema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    type: { type: String, required: true, enum: NOTE_TYPES },
    // Sparse so multiple "personal" notes (null) don't collide.
    company_id: { type: Schema.Types.ObjectId, ref: 'Company', default: null, index: { sparse: true } },
    dsa_problem_id: {
      type: Schema.Types.ObjectId,
      ref: 'DsaQuestion',
      default: null,
      index: { sparse: true },
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
)

noteSchema.index({ user_id: 1, type: 1 })
noteSchema.index({ user_id: 1, company_id: 1 })
noteSchema.index({ user_id: 1, dsa_problem_id: 1 })

export default mongoose.model('Note', noteSchema)
