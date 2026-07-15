// MongoDB connection (Mongoose).
// Single shared connection; models register themselves on the default
// mongoose connection, so nothing else needs to import this object — they
// just need this module to have been imported once at boot.

import mongoose from 'mongoose'
import { env } from './env.js'

/** @type {boolean} cached so connect() is idempotent across server + seeder. */
let isConnected = false

/**
 * Connect to MongoDB using the configured MONGODB_URI.
 * Idempotent — safe to call from both server.js and seed.js.
 *
 * Mongoose v8 is async-only; we explicitly listen for disconnections and
 * reconnections so logs reflect reality (especially on Render cold starts).
 *
 * @returns {Promise<typeof mongoose>}
 */
export async function connectDB() {
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose
  }

  // Event handlers (registered once).
  if (mongoose.connection.listenerCount('connected') === 0) {
    mongoose.connection.on('connected', () => {
      // eslint-disable-next-line no-console
      console.log('[mongo] connected')
    })
    mongoose.connection.on('error', (err) => {
      // eslint-disable-next-line no-console
      console.error('[mongo] error:', err.message)
    })
    mongoose.connection.on('disconnected', () => {
      // eslint-disable-next-line no-console
      console.warn('[mongo] disconnected')
    })
  }

  await mongoose.connect(env.MONGODB_URI, {
    // Reasonable defaults — mongoose 8 already auto-selects these, but we
    // pin them explicitly so upgrades don't silently change behaviour.
    serverSelectionTimeoutMS: 10000,
    autoIndex: env.APP_ENV !== 'prod', // Atlas prefers you manage indexes
  })

  isConnected = true
  return mongoose
}

/** Close the connection cleanly (used by tests + graceful shutdown). */
export async function closeDB() {
  if (!isConnected) return
  await mongoose.disconnect()
  isConnected = false
}

export default connectDB
