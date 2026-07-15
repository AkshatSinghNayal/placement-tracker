// ChecklistItem — one of the 15 fixed items for a UserCompany.

import mongoose from 'mongoose'

const { Schema } = mongoose

const checklistItemSchema = new Schema(
  {
    user_company_id: {
      type: Schema.Types.ObjectId,
      ref: 'UserCompany',
      required: true,
      index: true,
    },
    item_key: { type: String, required: true },
    label: { type: String, required: true },
    is_done: { type: Boolean, default: false },
    completed_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
)

// Unique per (user_company, item_key) — prevents duplicate seeds.
checklistItemSchema.index({ user_company_id: 1, item_key: 1 }, { unique: true })

export default mongoose.model('ChecklistItem', checklistItemSchema)
