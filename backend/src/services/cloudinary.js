// Cloudinary upload service (resume PDFs).
//
// On POST /api/v1/resumes/upload the PDF is uploaded to Cloudinary as a
// `resource_type: "raw"` asset (PDFs are binary, not image-transformable),
// and we persist the returned secure_url + public_id on the Resume doc.
//
// The frontend then displays the resume by hitting GET /resumes/{id}/pdf,
// which 302-redirects to the Cloudinary secure_url (Content-Disposition: inline).

import { v2 as cloudinary } from 'cloudinary'
import { env } from '../config/env.js'

let configured = false

/**
 * Lazily configure the Cloudinary SDK. If no credentials are present we
 * return false so the caller can fall back to storing the PDF bytes directly
 * in Mongo (BinData) — keeps local dev frictionless.
 */
function ensureConfigured() {
  if (configured) return true

  if (env.CLOUDINARY_URL) {
    cloudinary.config({ secure: true })
  } else if (env.CLOUDINARY_CLOUD_NAME) {
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
      secure: true,
    })
  } else {
    return false // no creds → caller should fall back to DB storage
  }

  configured = true
  return true
}

export function isCloudinaryConfigured() {
  return ensureConfigured()
}

/**
 * Upload a PDF buffer to Cloudinary.
 *
 * @param {Buffer} fileBytes
 * @param {string} filename  original filename (used for the public_id slug)
 * @param {object} [opts]
 * @param {string} [opts.folder="resumes"]
 * @returns {Promise<{secure_url: string, public_id: string}>}
 */
export async function uploadPdf(fileBytes, filename, opts = {}) {
  if (!ensureConfigured()) {
    throw new Error('Cloudinary is not configured')
  }
  const folder = opts.folder ?? 'resumes'
  // Cloudinary raw uploads accept a data URI.
  const dataUri = `data:application/pdf;base64,${fileBytes.toString('base64')}`
  const slug = filename
    .toLowerCase()
    .replace(/\.pdf$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const publicId = `${folder}/${slug}-${Date.now()}`

  const result = await cloudinary.uploader.upload(dataUri, {
    public_id: publicId,
    resource_type: 'raw',
    format: 'pdf',
    overwrite: false,
  })
  return { secure_url: result.secure_url, public_id: result.public_id }
}

/**
 * Destroy a previously-uploaded asset by public_id.
 * Best-effort: logs + swallows errors (a failed cleanup shouldn't 500 the request).
 */
export async function destroyFile(publicId) {
  if (!ensureConfigured() || !publicId) return
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'raw', invalidate: true })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[cloudinary] destroy failed for ${publicId}:`, err?.message)
  }
}
