import {NextResponse} from 'next/server'
import {v2 as cloudinary} from 'cloudinary'

// Secrets come from the environment only — no hardcoded fallbacks.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export {cloudinary}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export function optionsResponse() {
  return new Response(null, {status: 200, headers: corsHeaders})
}

// The Cloudinary SDK rejects with a plain object ({error: {message}, http_code}),
// not an Error — pull the real message out and propagate the SDK status.
export function cloudinaryErrorResponse(scope: string, error: unknown, fallback: string) {
  const err = error as {message?: string; http_code?: number; error?: {message?: string}}
  const message = err?.error?.message || err?.message || fallback
  const status = err?.http_code && err.http_code >= 400 && err.http_code < 600 ? err.http_code : 500
  console.error(`[cloudinary/${scope}] failed`, error)
  return NextResponse.json({error: message}, {status, headers: corsHeaders})
}
