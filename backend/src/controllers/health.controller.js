// Health check. Pings MongoDB via Mongoose; 200 if reachable, 503 otherwise.
// Matches the original /api/v1/health response shape: { status, db }.

import mongoose from 'mongoose'

export async function health(req, res) {
  try {
    // A trivial round-trip. adminPing is cheap and works on Atlas too.
    await mongoose.connection.db.admin().ping()
    return res.status(200).json({ status: 'ok', db: 'ok' })
  } catch (err) {
    return res.status(503).json({ status: 'degraded', db: 'unreachable' })
  }
}
