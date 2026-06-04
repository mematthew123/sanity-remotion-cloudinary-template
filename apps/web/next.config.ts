import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // The render route spawns a Vercel Sandbox via @remotion/vercel. Mark the
    // sandbox + vercel-remotion libs external so their native bits aren't
    // Turbopack-bundled into the function. Rendering happens inside the
    // sandbox, so no Chromium / compositor binaries ship with the function.
    serverExternalPackages: [
        '@vercel/sandbox',
        '@remotion/vercel',
        // React-Email components call hooks at render time. Without externalizing
        // them, Next.js bundles them against its compiled `react`, then the
        // hooks read the dispatcher from a different React instance (null) and
        // crash with "Cannot read properties of null (reading 'useMemo')".
        '@react-email/components',
        '@react-email/render',
        // NOTE: @portabletext/react is deliberately NOT externalized. It's used
        // by the post page (server component) where the bundled React instance
        // matters — externalizing it caused the same null-dispatcher crash in
        // reverse. The newsletter template now uses a custom Portable Text
        // walker (apps/web/components/emails/NewsletterTemplate.tsx) instead of
        // @portabletext/react, so the newsletter side is unaffected.
    ],
    // Workspace package ships raw TS via its `exports` field; Turbopack/Next
    // won't transpile node_modules unless this is set.
    transpilePackages: ['@template/video-core'],
    // In local dev (no VERCEL env var) the render route falls back to bundling
    // Remotion and uploading it to the sandbox at request time. Include the
    // bundle output in the function's traced files so the fallback works if it
    // ever runs on a serverful Node deploy (production uses the build-time
    // snapshot and skips this path).
    outputFileTracingIncludes: {
        '/api/video/render': ['./.remotion-bundle/**/*'],
    },
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'cdn.sanity.io',
            },
            {
                protocol: 'https',
                hostname: 'res.cloudinary.com',
            },
        ],
    },
};

export default nextConfig;
