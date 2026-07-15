// Multer middleware for resume PDF uploads.
//
// The frontend POSTs multipart/form-data with fields:
//   - file          the PDF (single file)
//   - version_label string label
//
// We use memoryStorage (file in req.file.buffer) so the controller can hand
// the bytes to Cloudinary without a temp file. Validation (PDF magic bytes,
// 5 MB cap) is enforced both here and in the controller — defense in depth.

import multer from 'multer'
import { badRequest } from '../utils/ApiError.js'

const MAX_PDF_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB — matches the frontend cap
const PDF_MAGIC = Buffer.from('%PDF-')

const storage = multer.memoryStorage()

/**
 * File filter: accept PDFs only, verify magic bytes + extension + size hint.
 * (multer enforces the hard byte limit via `limits`; the magic-byte check
 * lives in the controller because the buffer isn't fully read here yet.)
 */
function fileFilter(_req, file, cb) {
  if (file.mimetype !== 'application/pdf') {
    return cb(badRequest('only PDF files are accepted'))
  }
  if (!file.originalname.toLowerCase().endsWith('.pdf')) {
    return cb(badRequest('only .pdf files are accepted'))
  }
  return cb(null, true)
}

/** Configured multer instance for the single `file` field. */
export const uploadResume = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_PDF_SIZE_BYTES },
}).single('file')

/** Wrap multer so a rejection (wrong type / too big) becomes an ApiError
 *  handled by the central error middleware instead of Express's default. */
export function uploadResumeMiddleware(req, res, next) {
  uploadResume(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(badRequest(`file too large (max ${MAX_PDF_SIZE_BYTES} bytes / 5MB)`))
      }
      return next(err)
    }
    // Validate magic bytes now that the buffer is in memory.
    const buf = req.file?.buffer
    if (buf && (buf.length < 5 || buf.subarray(0, 5).toString('latin1') !== PDF_MAGIC.toString('latin1'))) {
      return next(badRequest('file does not appear to be a valid PDF (missing %PDF- header)'))
    }
    return next()
  })
}

export { MAX_PDF_SIZE_BYTES }
