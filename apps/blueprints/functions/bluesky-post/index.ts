import {documentEventHandler} from '@sanity/functions'
import {Client, BlueskyStrategy} from '@humanwhocodes/crosspost'
import {createClient} from '@sanity/client'

const BLUESKY_MAX_LENGTH = 300
const BLUESKY_MAX_IMAGE_BYTES = 1_000_000

interface VideoEventData {
  _id: string
  title: string | null
  gifUrl: string | null
  squareUrl: string | null
  postSlug: string | null
  postTitle: string | null
}

export const handler = documentEventHandler<VideoEventData>(async ({event}) => {
  const {_id, title, gifUrl, squareUrl, postSlug, postTitle} = event.data
  const {
    BLUESKY_USERNAME,
    BLUESKY_PASSWORD,
    BLUESKY_HOST = 'bsky.social',
    SANITY_PROJECT_ID,
    SANITY_DATASET,
    SANITY_WRITE_TOKEN,
    SITE_URL = '',
  } = process.env

  if (!BLUESKY_USERNAME || !BLUESKY_PASSWORD) {
    console.error('Missing BLUESKY_USERNAME or BLUESKY_PASSWORD — skipping')
    return
  }
  if (!SANITY_PROJECT_ID || !SANITY_DATASET || !SANITY_WRITE_TOKEN) {
    console.error(
      'Missing SANITY_PROJECT_ID / SANITY_DATASET / SANITY_WRITE_TOKEN — would post but cannot patch socialPostedAt; bailing to avoid double-post on retry',
    )
    return
  }

  // 1:1 square crops compose better on the BlueSky timeline than the wider GIF.
  // Fall back to the GIF if the composition didn't opt into the square variant,
  // and text-only if neither variant exists.
  const imageUrl = squareUrl ?? gifUrl
  const headline =
    postTitle && title ? `${postTitle}: ${title}` : title ?? postTitle ?? 'New video'
  const linkUrl = SITE_URL && postSlug ? `${SITE_URL}/posts/${postSlug}` : null

  let postText: string
  if (linkUrl && headline.length + linkUrl.length + 1 <= BLUESKY_MAX_LENGTH) {
    postText = `${headline}\n${linkUrl}`
  } else {
    postText = headline.slice(0, BLUESKY_MAX_LENGTH)
  }

  console.log(`Posting to BlueSky (${postText.length} chars): "${headline}"`)

  const bluesky = new BlueskyStrategy({
    identifier: BLUESKY_USERNAME,
    password: BLUESKY_PASSWORD,
    host: BLUESKY_HOST,
  })
  const client = new Client({strategies: [bluesky]})

  let postOptions: Parameters<Client['post']>[1] = {}
  if (imageUrl) {
    try {
      const response = await fetch(imageUrl)
      const buffer = new Uint8Array(await response.arrayBuffer())
      if (buffer.length <= BLUESKY_MAX_IMAGE_BYTES) {
        postOptions = {images: [{data: buffer, alt: title ?? headline}]}
        console.log(`Fetched variant image (${buffer.length} bytes)`)
      } else {
        console.warn(
          `Variant image too large (${buffer.length} > ${BLUESKY_MAX_IMAGE_BYTES} bytes); posting text-only`,
        )
      }
    } catch (err) {
      console.error('Failed to fetch variant image, posting without it:', err)
    }
  }

  let succeeded = false
  try {
    const results = await client.post(postText, postOptions)
    for (const r of results) {
      // `in` narrows the SuccessResponse | FailureResponse union without
      // relying on `ok` being declared as a literal discriminator.
      if ('url' in r) {
        succeeded = true
        console.log(`BlueSky post URL: ${r.url}`)
      } else if ('reason' in r) {
        console.error('BlueSky failure:', JSON.stringify(r.reason))
      }
    }
    if (!succeeded) return
  } catch (err) {
    console.error('Error posting to BlueSky:', err)
    return
  }

  // Idempotency marker. No revision guard: a race between two firings would
  // result in two BlueSky posts AND two patches setting the same field — the
  // patches are no-ops once one lands, and the doc is excluded by the filter
  // from any subsequent updates. At-most-once semantics, not exactly-once.
  try {
    const sanity = createClient({
      projectId: SANITY_PROJECT_ID,
      dataset: SANITY_DATASET,
      token: SANITY_WRITE_TOKEN,
      useCdn: false,
      apiVersion: '2024-01-01',
    })
    await sanity.patch(_id).set({socialPostedAt: new Date().toISOString()}).commit()
    console.log(`Patched socialPostedAt on ${_id}`)
  } catch (err) {
    console.error(`Failed to patch socialPostedAt on ${_id} — function will refire on next update:`, err)
  }
})
