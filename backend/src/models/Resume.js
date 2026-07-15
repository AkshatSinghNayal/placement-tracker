// Resume. PDF bytes stored as BinData in pdf_data (no Cloudinary).
// "Exactly one active resume per user" is enforced in the service layer
// (Mongoose has no partial unique index equivalent).

import mongoose from 'mongoose'

const { Schema } = mongoose

const resumeSchema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    version_label: { type: String, required: true, trim: true },
    cloudinary_url: { type: String, default: null },  // kept for migrating old documents
    cloudinary_public_id: { type: String, default: null },
    pdf_data: { type: Buffer, default: null },
    is_active: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
)

resumeSchema.index({ user_id: 1, is_active: 1 })

export default mongoose.model('Resume', resumeSchema)
