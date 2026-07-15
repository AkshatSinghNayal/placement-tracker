// Password-reset token (opaque, SHA-256 hashed, 30-min TTL).

import mongoose from 'mongoose'

const { Schema } = mongoose

const passwordResetTokenSchema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    token_hash: { type: String, required: true, unique: true },
    expires_at: { type: Date, required: true },
    used_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
)

export default mongoose.model('PasswordResetToken', passwordResetTokenSchema)
