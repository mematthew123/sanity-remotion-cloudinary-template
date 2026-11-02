export const SANITY_CONTEXT_TOKEN = process.env.SANITY_CONTEXT_TOKEN;
export const SANITY_CONTEXT_ASSISTANT_URL = process.env.SANITY_CONTEXT_ASSISTANT_URL;
export const SANITY_CONTEXT_CATALOG_URL = process.env.SANITY_CONTEXT_CATALOG_URL;
export const MAX_QUESTION_CHARS = 1500;

export function isAskEnabled(): boolean {
  return Boolean(
    SANITY_CONTEXT_TOKEN &&
      SANITY_CONTEXT_ASSISTANT_URL &&
      SANITY_CONTEXT_CATALOG_URL &&
      (process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL),
  );
}
