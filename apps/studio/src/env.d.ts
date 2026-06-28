// Vite exposes only `SANITY_STUDIO_*` env vars to the Studio client bundle via
// `import.meta.env`. These ambient declarations make those reads typecheck.
interface ImportMetaEnv {
  readonly SANITY_STUDIO_PROJECT_ID: string
  readonly SANITY_STUDIO_DATASET: string
  readonly SANITY_STUDIO_RENDER_API_URL: string
  readonly SANITY_STUDIO_RENDER_SECRET: string
  readonly SANITY_STUDIO_NEWSLETTER_API_URL: string
  readonly SANITY_STUDIO_NEWSLETTER_SECRET: string
  // Optional: 'true' enables the ElevenLabs-backed `article-narrated` composition.
  readonly SANITY_STUDIO_ENABLE_NARRATED?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
