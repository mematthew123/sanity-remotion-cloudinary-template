import {defineBlueprint, defineDocumentFunction} from '@sanity/blueprints'
import 'dotenv/config'

const {
  BLUESKY_USERNAME = '',
  BLUESKY_PASSWORD = '',
  BLUESKY_HOST = 'bsky.social',
  SANITY_PROJECT_ID = '',
  SANITY_DATASET = '',
  SANITY_WRITE_TOKEN = '',
  SITE_URL = '',
} = process.env

export default defineBlueprint({
  resources: [
    defineDocumentFunction({
      name: 'bluesky-post',
      src: './functions/bluesky-post',
      memory: 1,
      timeout: 30,
      event: {
        on: ['create', 'update'],
        // `defined(variants)` guards against firing before the render route's
        // atomic status+variants patch lands. `!defined(socialPostedAt)` is the
        // idempotency marker the function writes back on success.
        filter:
          '_type == "video" && status == "ready" && defined(variants) && !defined(socialPostedAt)',
        // Variant URLs are flattened to the top of the projection so the
        // function doesn't have to traverse the array at runtime. Post fields
        // are dereferenced once here too — only one round-trip to the dataset.
        projection: `{
          _id,
          title,
          "gifUrl": variants[variantId == "site-preview-gif"][0].url,
          "squareUrl": variants[variantId == "social-1x1"][0].url,
          "postSlug": post->slug.current,
          "postTitle": post->title
        }`,
      },
      env: {
        BLUESKY_USERNAME,
        BLUESKY_PASSWORD,
        BLUESKY_HOST,
        SANITY_PROJECT_ID,
        SANITY_DATASET,
        SANITY_WRITE_TOKEN,
        SITE_URL,
      },
    }),
  ],
})
