import {getCldVideoUrl} from 'next-cloudinary'


let cachedParam: string | null | undefined

function analyticsParam(cloudName: string): string | null {
  if (cachedParam !== undefined) return cachedParam
  try {
    const probe = getCldVideoUrl(
      {src: 'analytics-probe', format: 'mp4'},
      {cloud: {cloudName}},
    )
    const value = new URL(probe).searchParams.get('_a')
    cachedParam = value ? `_a=${value}` : null
  } catch {
    cachedParam = null
  }
  return cachedParam
}

/**
 * Append the SDK analytics signature to a persisted Cloudinary delivery URL.
 * Returns the URL unchanged if the signature can't be resolved (graceful — we
 * never want analytics to break delivery). `VARIANTS` stays the single source of
 * truth for transforms; this only adds a tracking query param.
 */
export function withCloudinaryAnalytics(cloudName: string, url: string): string {
  const param = analyticsParam(cloudName)
  if (!param) return url
  return url.includes('?') ? `${url}&${param}` : `${url}?${param}`
}
