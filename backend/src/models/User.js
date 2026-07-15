// User. Email/password OR Google-only (hashed_password null when google_sub set).
//
// CHECK-constraint equivalent (ck_users_has_auth_method) is enforced in app
// code: signup/login always set a password; OAuth-created users set google_sub.

import mongoose from 'mongoose'

const { Schema } = mongoose

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    full_name: { type: String, required: true, maxlength: 120 },
    // Null for Google-only accounts. select:false so it never leaks into a
    // response unless explicitly requested (.select('+password')).
    password: { type: String, required: false, select: false },
    // Google subject id. Null for password-only accounts. Sparse unique so
    // many password-only users can share google_sub: null.
    google_sub: { type: String, required: false, index: { unique: true, sparse: true } },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
)

// `has_google_linked` is computed (not stored) — exposed via the transformer,
// but this virtual is handy for internal logic / tests.
userSchema.virtual('has_google_linked').get(function () {
  return Boolean(this.google_sub)
})

export default mongoose.model('User', userSchema)
