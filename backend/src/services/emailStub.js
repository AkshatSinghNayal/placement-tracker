// Password-reset "email" — stubbed. The original FastAPI app doesn't send real
// email; it prints a [EMAIL-STUB] line to stdout (and optionally writes the
// reset token to a file so tests can extract it). We preserve that behaviour.

import { writeFileSync, appendFileSync } from 'node:fs'
import { env } from '../config/env.js'

/**
 * @param {string} toEmail
 * @param {string} fullName
 * @param {string} rawResetToken
 */
export function buildPasswordResetEmail(toEmail, fullName, rawResetToken) {
  const subject = 'OfferForge — password reset'
  // Reset link points at the FRONTEND reset route. The frontend reads the
  // token from the URL and POSTs it to /auth/password-reset/confirm.
  const resetLink = `${env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(rawResetToken)}`
  const body = [
    `Hi ${fullName},`,
    '',
    "We received a request to reset your OfferForge password. Use the link below:",
    resetLink,
    '',
    'If you did not make this request, you can safely ignore this email.',
    '',
    '— OfferForge',
  ].join('\n')
  return { subject, body }
}

/** "Send" the email: stdout (+ optional file for test extraction). */
export function sendEmail({ toEmail, subject, body }) {
  const line = `[EMAIL-STUB] to=${toEmail} subject="${subject}"\n${body}\n`
  // eslint-disable-next-line no-console
  console.log(line)
  if (env.EMAIL_STUB_FILE) {
    try {
      appendFileSync(env.EMAIL_STUB_FILE, line, 'utf8')
    } catch {
      // best-effort — never fail a reset on stub-write error
    }
  }
}
