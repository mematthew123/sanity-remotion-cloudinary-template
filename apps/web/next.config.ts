import type { NextConfig } from "next";
import path from "path";

// Monorepo: pnpm node-linker=hoisted puts shared deps at the repo root, not
// under apps/web/node_modules. outputFileTracingRoot must point at the repo
// root so include globs can reach files outside apps/web — without this,
// Next.js silently drops anything outside the project directory.
const monorepoRoot = path.join(process.cwd(), "../..");

const nextConfig: NextConfig = {
    serverExternalPackages: ['@remotion/renderer', '@sparticuz/chromium'],
    // Workspace package ships raw TS via its `exports` field; Turbopack/Next
    // won't transpile node_modules unless this is set.
    transpilePackages: ['@template/video-core'],
    outputFileTracingRoot: monorepoRoot,
    outputFileTracingIncludes: {
        '/api/video/render': [
            './.remotion-bundle/**/*',
            // Hoisted location in this repo. The brotli files in
            // @sparticuz/chromium/bin (chromium.br, swiftshader.tar.br, etc.)
            // are loaded at runtime via fs, so static tracing misses them
            // unless explicitly included.
            '../../node_modules/@remotion/compositor-linux-x64-gnu/**/*',
            '../../node_modules/@sparticuz/chromium/**/*',
            // Fallback for non-hoisted installs
            './node_modules/@remotion/compositor-linux-x64-gnu/**/*',
            './node_modules/@sparticuz/chromium/**/*',
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
