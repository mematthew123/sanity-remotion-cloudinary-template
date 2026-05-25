import type { NextConfig } from "next";
import path from "path";

// Monorepo: pnpm node-linker=hoisted puts shared deps at the repo root, not
// under apps/web/node_modules. outputFileTracingRoot must point at the repo
// root so include globs can reach files outside apps/web — without this,
// Next.js silently drops anything outside the project directory.
const monorepoRoot = path.join(process.cwd(), "../..");

const nextConfig: NextConfig = {
    serverExternalPackages: ['@remotion/renderer', '@sparticuz/chromium-min'],
    // Workspace package ships raw TS via its `exports` field; Turbopack/Next
    // won't transpile node_modules unless this is set.
    transpilePackages: ['@template/video-core'],
    outputFileTracingRoot: monorepoRoot,
    outputFileTracingIncludes: {
        '/api/video/render': [
            './.remotion-bundle/**/*',
            // The Remotion Linux compositor binary must ship with the function.
            // Chromium is NOT bundled — @sparticuz/chromium-min downloads it at
            // runtime, which keeps the function under Vercel's 250 MB limit.
            // Both paths are listed to cover hoisted and isolated pnpm layouts.
            '../../node_modules/@remotion/compositor-linux-x64-gnu/**/*',
            './node_modules/@remotion/compositor-linux-x64-gnu/**/*',
        ],
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
