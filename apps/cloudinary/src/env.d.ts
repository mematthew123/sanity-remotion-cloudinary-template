/**
 * Ambient typings for the env vars this app reads. The App SDK / Vite inlines
 * every `SANITY_APP_*` variable into the bundle at build time, exposed on
 * `process.env`. All are optional here so the app type-checks without a local
 * `.env` (it falls back to sensible defaults at runtime) — see `.env.example`.
 */
declare namespace NodeJS {
  interface ProcessEnv {
    /** Sanity project the `video` documents live in. */
    readonly SANITY_APP_PROJECT_ID?: string
    /** Sanity dataset, e.g. "production". */
    readonly SANITY_APP_DATASET?: string
    /** Sanity organization that owns this App SDK app. */
    readonly SANITY_APP_ORGANIZATION_ID?: string
    /** Base URL of the web app exposing the `/api/cloudinary/*` proxy routes. */
    readonly SANITY_APP_API_BASE?: string
    /** Cloudinary cloud name, used to build delivery/transform URLs client-side. */
    readonly SANITY_APP_CLOUDINARY_CLOUD_NAME?: string
  }
}
