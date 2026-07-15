// Centralised, validated environment access for the whole backend.
// Every other module imports `env` from here — no direct process.env reads
// elsewhere (so defaults + types live in exactly one place).

import dotenv from 'dotenv'

dotenv.config()

/**
 * Read an env var with a default. Trims surrounding whitespace.
 * @param {string} key
 * @param {string} [fallback]
 */
function str(key, fallback = '') {
  const v = process.env[key]
  return v === undefined || v === '' ? fallback : String(v).trim()
}

function int(key, fallback) {
  const raw = str(key, '')
  if (raw === '') return fallback
  const n = Number.parseInt(raw, 10)
  return Number.isNaN(n) ? fallback : n
}

function bool(key, fallback) {
  const raw = str(key, '').toLowerCase()
  if (raw === '') return fallback
  return raw === '1' || raw === 'true' || raw === 'yes'
}

const APP_ENV = str('APP_ENV', 'dev')
const IS_PROD = APP_ENV === 'prod'
const IS_TEST = APP_ENV === 'test'

const JWT_SECRET = str('JWT_SECRET', 'dev-only-not-secret-change-me')
// Refuse to boot in prod with the dev placeholder secret.
if (IS_PROD && JWT_SECRET.startsWith('dev-only')) {
  // eslint-disable-next-line no-console
  console.error('FATAL: JWT_SECRET must be set to a real secret in production.')
  process.exit(1)
}

const PORT = int('PORT', 8000)
const MONGODB_URI = str('MONGODB_URI', 'mongodb://mongodb:27017/placement_tracker')

// ms-style JWT expiry (jsonwebtoken accepts seconds as a plain number, but
// "15m"/"7d" is more readable — we keep both forms working below).
const JWT_EXPIRES_IN = str('JWT_EXPIRES_IN', '15m')
const ACCESS_TOKEN_TTL_MINUTES = int('ACCESS_TOKEN_TTL_MINUTES', 15)
const REFRESH_TOKEN_TTL_DAYS = int('REFRESH_TOKEN_TTL_DAYS', 7)
const PASSWORD_RESET_TTL_MINUTES = int('PASSWORD_RESET_TTL_MINUTES', 30)

const FRONTEND_URL = str('FRONTEND_URL', 'http://localhost:5173').replace(/\/$/, '')
const BACKEND_URL = str('BACKEND_URL', `http://localhost:${PORT}`).replace(/\/$/, '')

// --- Derived: cookie + CORS config ---------------------------------------
// Vercel (frontend) + Render (backend) are different origins in production,
// so the refresh cookie MUST be SameSite=None;Secure to survive cross-origin
// XHR with withCredentials:true. In local docker-compose both are on
// localhost → SameSite=Lax is enough (browsers reject SameSite=None w/o Secure).
const backendIsHttps = BACKEND_URL.toLowerCase().startsWith('https://')
const COOKIE_SECURE = backendIsHttps || IS_PROD
const COOKIE_SAMESITE = COOKIE_SECURE ? 'none' : 'lax'

export const env = Object.freeze({
  APP_ENV,
  IS_PROD,
  IS_TEST,
  PORT,
  MONGODB_URI,

  JWT_SECRET,
  JWT_ALGORITHM: 'HS256',
  JWT_EXPIRES_IN,
  ACCESS_TOKEN_TTL_MINUTES,
  REFRESH_TOKEN_TTL_DAYS,
  PASSWORD_RESET_TTL_MINUTES,

  GOOGLE_CLIENT_ID: str('GOOGLE_CLIENT_ID'),
  GOOGLE_CLIENT_SECRET: str('GOOGLE_CLIENT_SECRET'),
  GOOGLE_OAUTH_REDIRECT_URI: `${BACKEND_URL}/api/v1/auth/google/callback`,

  CLOUDINARY_CLOUD_NAME: str('CLOUDINARY_CLOUD_NAME'),
  CLOUDINARY_API_KEY: str('CLOUDINARY_API_KEY'),
  CLOUDINARY_API_SECRET: str('CLOUDINARY_API_SECRET'),
  CLOUDINARY_URL: str('CLOUDINARY_URL'),

  FRONTEND_URL,
  BACKEND_URL,
  CORS_ORIGINS: [FRONTEND_URL],

  // Cookie
  REFRESH_COOKIE_NAME: 'refresh_token',
  REFRESH_COOKIE_PATH: '/api/v1/auth',
  COOKIE_SECURE,
  COOKIE_SAMESITE,
  REFRESH_COOKIE_MAX_AGE: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,

  EMAIL_STUB_FILE: str('EMAIL_STUB_FILE'),
})

export default env
