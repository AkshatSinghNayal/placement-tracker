// Express application entry-point.
//
// Boot order:
//   1. Load env (dotenv via config/env.js — must be first)
//   2. Connect MongoDB
//   3. Run company seeder (idempotent — no-op once the 25 catalog companies exist)
//   4. Mount middleware + routes
//   5. Start listening
//
// Signal handling: SIGTERM / SIGINT drain in-flight requests and close the
// Mongoose connection cleanly (important on Render free tier + K8s).

import './config/env.js' // side-effect: loads dotenv
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'

import { env } from './config/env.js'
import { connectDB, closeDB } from './config/db.js'
import { setupPassport } from './services/passport.js'
import apiRouter from './routes/index.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'

// ---------------------------------------------------------------------------
// App factory (exported so tests can import without listening)
// ---------------------------------------------------------------------------

export function createApp() {
  const app = express()

  // --- Security headers (permissive defaults for API) ----------------------
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow PDF redirect
      contentSecurityPolicy: false, // API; no HTML
    }),
  )

  // --- CORS ----------------------------------------------------------------
  // Credentials: true so the browser sends httpOnly cookies on withCredentials requests.
  // origin MUST be explicit (not '*') when credentials: true.
  app.use(
    cors({
      origin: env.CORS_ORIGINS,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: ['X-Token-Expired'], // frontend watches for this header
    }),
  )

  // --- Request logging (skip in test) --------------------------------------
  if (env.APP_ENV !== 'test') {
    app.use(morgan(env.IS_PROD ? 'combined' : 'dev'))
  }

  // --- Body parsers --------------------------------------------------------
  app.use(express.json({ limit: '2mb' }))
  app.use(express.urlencoded({ extended: true, limit: '2mb' }))
  app.use(cookieParser())

  // --- Rate limiting (generous; mainly for auth endpoints) -----------------
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 min
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { detail: 'too many requests, please try again later' },
    skip: () => env.APP_ENV === 'test',
  })
  app.use(limiter)

  // Stricter limit for auth endpoints to slow brute-force.
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { detail: 'too many auth requests, please slow down' },
    skip: () => env.APP_ENV === 'test',
  })
  app.use('/api/v1/auth/login', authLimiter)
  app.use('/api/v1/auth/signup', authLimiter)
  app.use('/api/v1/auth/password-reset', authLimiter)

  // --- Passport (Google OAuth strategy) -----------------------------------
  setupPassport()

  // --- API routes ----------------------------------------------------------
  app.use('/api/v1', apiRouter)

  // --- Catch-all 404 + central error handler (must be last) ----------------
  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

async function bootstrap() {
  // 1. Database
  await connectDB()

  // 2. Run the seeder (idempotent — exits immediately when data already exists).
  try {
    const { seed } = await import('./seed/seed.js')
    await seed()
  } catch (err) {
    // Non-fatal: a seeder failure must not prevent the API from starting.
    // eslint-disable-next-line no-console
    console.error('[seeder] failed (non-fatal):', err.message)
  }

  // 3. Start server
  const app = createApp()
  const server = app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[server] listening on port ${env.PORT} (${env.APP_ENV})`)
  })

  // --- Graceful shutdown ---------------------------------------------------
  const shutdown = async (signal) => {
    // eslint-disable-next-line no-console
    console.log(`[server] ${signal} received — shutting down…`)
    server.close(async () => {
      await closeDB()
      // eslint-disable-next-line no-console
      console.log('[server] shutdown complete')
      process.exit(0)
    })
    // Force exit if drain takes too long (e.g. keep-alive sockets).
    setTimeout(() => process.exit(1), 10000)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[server] fatal startup error:', err)
  process.exit(1)
})
