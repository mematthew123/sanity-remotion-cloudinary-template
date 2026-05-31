import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // Rendering runs on AWS Lambda; the render route only invokes it through
    // @remotion/lambda/client. Mark it external so its AWS SDK deps aren't
    // bundled by Turbopack/webpack. No Chromium or compositor binary ships with
    // the function anymore, so outputFileTracing* is no longer needed.
    serverExternalPackages: ['@remotion/lambda'],
    // Workspace package ships raw TS via its `exports` field; Turbopack/Next
    // won't transpile node_modules unless this is set.
    transpilePackages: ['@template/video-core'],
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
