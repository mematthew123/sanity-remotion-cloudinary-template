// Twitter/X uses the same branded card as Open Graph. Re-export the default
// route module so there's a single source of truth in opengraph-image.tsx.
export { default, alt, size, contentType } from './opengraph-image';
