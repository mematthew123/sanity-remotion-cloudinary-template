import { createMCPClient, type InitializeResult, type ListToolsResult } from '@ai-sdk/mcp';
import { SANITY_CONTEXT_TOKEN } from '@/lib/askConfig';

const CACHE_TTL_MS = 10 * 60_000;
const initialContextCache = new Map<string, { text: string; fetchedAt: number }>();
const toolDefinitionsCache = new Map<
  string,
  { initializeResult: InitializeResult; definitions: ListToolsResult; fetchedAt: number }
>();

function authHeaders() {
  return { Authorization: `Bearer ${SANITY_CONTEXT_TOKEN}` };
}

export async function getInitialContext(mcpUrl: string): Promise<string> {
  const cached = initialContextCache.get(mcpUrl);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.text;

  const url = new URL(mcpUrl);
  url.pathname = `${url.pathname.replace(/\/$/, '')}/initial-context`;
  const res = await fetch(url, { headers: authHeaders(), cache: 'no-store' });
  if (!res.ok) throw new Error(`Sanity Context initial-context failed (${res.status}) for ${mcpUrl}`);

  const text = await res.text();
  initialContextCache.set(mcpUrl, { text, fetchedAt: Date.now() });
  return text;
}

export async function connectContextTools(mcpUrl: string) {
  const cached = toolDefinitionsCache.get(mcpUrl);
  const fresh = cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS ? cached : undefined;
  const client = await createMCPClient({
    transport: { type: 'http', url: mcpUrl, headers: authHeaders() },
    initialInitializeResult: fresh?.initializeResult,
  });
  try {
    const definitions = fresh?.definitions ?? (await client.listTools());
    if (!fresh) {
      toolDefinitionsCache.set(mcpUrl, {
        initializeResult: client.initializeResult,
        definitions,
        fetchedAt: Date.now(),
      });
    }
    const tools = client.toolsFromDefinitions(definitions);
    delete tools.initial_context;
    return { client, tools };
  } catch (err) {
    await client.close();
    throw err;
  }
}
