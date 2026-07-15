// Refresh token (opaque). Stores only the SHA-256 hash; the raw token lives
// only in the httpOnly cookie. Rotation = revoke(old) + insert(new).

import mongoose from 'mongoose'

const { Schema } = mongoose

const refreshTokenSchema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    token_hash: { type: String, required: true, unique: true },
    expires_at: { type: Date, required: true },
    revoked: { type: Boolean, default: false, index: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
)

// Lookup path: by hash (unique). Housekeeping: find active by user.
refreshTokenSchema.index({ user_id: 1, revoked: 1 })

export default mongoose.model('RefreshToken', refreshTokenSchema)
