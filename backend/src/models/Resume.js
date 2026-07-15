// Resume. PDF bytes are uploaded to Cloudinary (cloudinary_url/public_id
// populated). pdf_data is a fallback BinData buffer when Cloudinary isn't
// configured (local dev). "Exactly one active resume per user" is enforced
// in the service layer (Mongoose has no partial unique index equivalent).

import mongoose from 'mongoose'

const { Schema } = mongoose

const resumeSchema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    version_label: { type: String, required: true, trim: true },
    // Populated when Cloudinary is configured; otherwise the bytes are kept here.
    cloudinary_url: { type: String, default: null },
    cloudinary_public_id: { type: String, default: null },
    pdf_data: { type: Buffer, default: null },
    is_active: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
)

resumeSchema.index({ user_id: 1, is_active: 1 })

export default mongoose.model('Resume', resumeSchema)
