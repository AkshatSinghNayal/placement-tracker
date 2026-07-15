// DSA tag. Shared across users (case-insensitive unique name).

import mongoose from 'mongoose'

const { Schema } = mongoose

const dsaTagSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
)

// Case-insensitive unique: the original used lower(name). Mongoose collation
// gives us the same guarantee.
dsaTagSchema.index(
  { name: 1 },
  {
    unique: true,
    collation: { locale: 'en', strength: 2 }, // strength 2 = case-insensitive
  },
)

export default mongoose.model('DsaTag', dsaTagSchema)
