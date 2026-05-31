# Documentation

Guides for the Sanity + Remotion + Cloudinary video template. Start with the root [README](../README.md) for the quickstart, then dig in here.

- **[Architecture](./architecture.md)** — the render pipeline, the React-free registry boundary, the Cloudinary variant system, and how rendered video surfaces.
- **[Configuration](./configuration.md)** — prerequisites, the three env prefixes, a full env reference, the shared render secret, and the Sanity token requirements.
- **[Remotion Lambda](./lambda.md)** — the AWS/IAM setup, deploying the render function and site bundle, and the env vars the render route needs.
- **[The App SDK app](./apps.md)** — the video editor app, local dev, and the deploy flow (interactive first deploy → pin `appId` → non-interactive).
- **[Assist + brand voice](./assist.md)** — the AI field actions, seeding the brand-voice doc, and customizing the voice.
- **[Troubleshooting](./troubleshooting.md)** — the issues you're most likely to hit, with fixes.
