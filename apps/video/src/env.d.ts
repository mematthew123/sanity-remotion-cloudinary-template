/**
 * Ambient typings for the App SDK's build-time environment.
 *
 * The Sanity App CLI inlines `process.env.SANITY_APP_*` values into the client
 * bundle (Vite-style `define`), so they read as plain strings at runtime. There
 * is no Node `process` in the browser — only these statically-replaced keys are
 * available. Declaring them here keeps `process.env.SANITY_APP_*` strictly typed
 * without pulling in `@types/node`'s broad `ProcessEnv`.
 */
declare namespace NodeJS {
  interface ProcessEnv {
    /** Sanity project id the app reads/writes against. */
    readonly SANITY_APP_PROJECT_ID: string
    /** Sanity dataset name, e.g. "production". */
    readonly SANITY_APP_DATASET: string
    /** Organization that owns the deployed app (used by sanity.cli.ts). */
    readonly SANITY_APP_ORGANIZATION_ID?: string
    /** Full URL of the web app's render endpoint, e.g. http://localhost:3000/api/video/render */
    readonly SANITY_APP_RENDER_API_URL: string
    /** Bearer secret for the render endpoint (== web app's VIDEO_RENDER_SECRET). */
    readonly SANITY_APP_RENDER_SECRET: string
  }
}
