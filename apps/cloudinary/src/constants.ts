import type {TransformPreset} from './types'

/**
 * Cloudinary cloud name used to build delivery/transform URLs in the browser.
 * Set SANITY_APP_CLOUDINARY_CLOUD_NAME to your cloud; the placeholder only
 * keeps things type-safe until configured.
 */
export const CLOUD_NAME = process.env.SANITY_APP_CLOUDINARY_CLOUD_NAME || 'your-cloud-name'

/**
 * Base URL of the web app exposing the `/api/cloudinary/*` proxy routes.
 * Defaults to the local Next.js dev server.
 */
export const API_BASE = process.env.SANITY_APP_API_BASE || 'http://localhost:3000'

/** Cloudinary folder that the web app's render route uploads videos into. */
export const VIDEOS_FOLDER = 'template/videos'

/** Generic social-format crop presets surfaced in the Transform tab. */
export const SOCIAL_PRESETS: TransformPreset[] = [
  {
    name: 'instagram-square',
    label: 'Instagram Square',
    width: 1080,
    height: 1080,
    crop: 'fill',
    gravity: 'auto',
    platform: 'Instagram',
  },
  {
    name: 'instagram-reel',
    label: 'Instagram Reel',
    width: 1080,
    height: 1920,
    crop: 'fill',
    gravity: 'auto',
    platform: 'Instagram',
  },
  {
    name: 'tiktok',
    label: 'TikTok',
    width: 1080,
    height: 1920,
    crop: 'fill',
    gravity: 'auto',
    platform: 'TikTok',
  },
  {
    name: 'youtube-thumbnail',
    label: 'YouTube Thumbnail',
    width: 1280,
    height: 720,
    crop: 'fill',
    gravity: 'auto',
    platform: 'YouTube',
  },
  {
    name: 'twitter-post',
    label: 'Twitter/X Post',
    width: 1200,
    height: 675,
    crop: 'fill',
    gravity: 'auto',
    platform: 'Twitter/X',
  },
  {
    name: 'facebook-cover',
    label: 'Facebook Cover',
    width: 1640,
    height: 624,
    crop: 'fill',
    gravity: 'auto',
    platform: 'Facebook',
  },
]
