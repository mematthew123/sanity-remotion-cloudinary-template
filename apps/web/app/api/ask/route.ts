import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from 'ai';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  isAskEnabled,
  MAX_QUESTION_CHARS,
  SANITY_CONTEXT_ASSISTANT_URL,
  SANITY_CONTEXT_CATALOG_URL,
} from '@/lib/askConfig';
import { isRateLimited } from '@/lib/askThrottle';
import { connectContextTools, getInitialContext } from '@/lib/sanityContext';
import { SITE_URL } from '@/lib/siteUrl';

export const maxDuration = 60;

const MODEL = 'anthropic/claude-haiku-4.5';
const MAX_MESSAGES = 12;
const MAX_HISTORY_CHARS = 16_000;

const textPartSchema = z.object({ type: z.literal('text'), text: z.string() });
const bodySchema = z.object({
  messages: z.array(z.object({ id: z.string(), role: z.string(), parts: z.array(z.unknown()) })),
});

function buildInstructions(knowledgeBaseOutline: string, catalogSchema: string): string {
  return [
    'You answer visitors\' questions about this site: the articles it publishes, the videos rendered from them, and the open-source template the site is built on (how it works and how to set it up).',
    '',
    'You have two read-only sources:',
    '- Knowledge Base tools (`knowledge_base_search`, `knowledge_base_read`): one Knowledge Base holding facts from the articles and the template\'s documentation (architecture, setup, configuration, deployment, costs, troubleshooting). Use these first for what/why/how questions.',
    `- Catalog tools (\`groq_query\`, \`schema_explorer\`, \`array_field_reader\`): the live posts and videos. Use these for lists, dates, links, and video URLs. A post lives at ${SITE_URL}/posts/<slug.current>.`,
    '',
    'Answer only from what these tools return. If they do not cover the question, say so plainly instead of guessing.',
    'When an answer draws on the template docs, end it with the matching doc link from the Knowledge Base instructions.',
    'Reply with the answer only. Do not announce or describe the lookups you are making.',
    'Keep answers short: a few sentences or a brief list.',
    'Format as plain text. No Markdown: no asterisks, no bold, no # headings. Start list items with "- ". Put each URL on its own line as a bare link.',
    '',
    '# Knowledge Base outline',
    knowledgeBaseOutline,
    '',
    '# Catalog schema',
    catalogSchema,
  ].join('\n');
}

function fulfilled<T>(results: PromiseSettledResult<T>[]): T[] {
  return results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
}

function textLength(message: UIMessage): number {
  return message.parts.reduce(
    (total, part) => total + (part.type === 'text' ? part.text.length : 0),
    0,
  );
}

function toTextMessages(body: unknown): UIMessage[] {
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return [];
  return parsed.data.messages.flatMap(({ id, role, parts }) => {
    if (role !== 'user' && role !== 'assistant') return [];
    const textParts = parts.flatMap((part) => {
      const text = textPartSchema.safeParse(part);
      return text.success ? [text.data] : [];
    });
    return textParts.length > 0 ? [{ id, role, parts: textParts }] : [];
  });
}

function trimHistory(messages: UIMessage[]): UIMessage[] {
  const kept: UIMessage[] = [];
  let total = 0;
  for (const message of messages.slice(-MAX_MESSAGES).reverse()) {
    total += textLength(message);
    if (total > MAX_HISTORY_CHARS) break;
    kept.unshift(message);
  }
  while (kept[0]?.role === 'assistant') kept.shift();
  return kept;
}

export async function POST(req: NextRequest) {
  if (!isAskEnabled()) {
    return NextResponse.json({ error: 'Ask is not configured.' }, { status: 404 });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Too many questions. Try again in a few minutes.' },
      { status: 429 },
    );
  }

  const allMessages = toTextMessages(await req.json().catch(() => null));
  const question = allMessages.at(-1);
  if (!question || question.role !== 'user') {
    return NextResponse.json({ error: 'Ask a question.' }, { status: 400 });
  }
  if (textLength(question) > MAX_QUESTION_CHARS) {
    return NextResponse.json(
      { error: `Keep questions under ${MAX_QUESTION_CHARS} characters.` },
      { status: 400 },
    );
  }

  const urls = [SANITY_CONTEXT_ASSISTANT_URL!, SANITY_CONTEXT_CATALOG_URL!];
  const [connected, initialContexts] = await Promise.all([
    Promise.allSettled(urls.map(connectContextTools)),
    Promise.allSettled(urls.map(getInitialContext)),
  ]);
  const connections = fulfilled(connected);
  const closeAll = async () => {
    await Promise.allSettled(connections.map(({ client }) => client.close()));
  };

  try {
    const failed = [...connected, ...initialContexts].find(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );
    if (failed) throw failed.reason;

    const [knowledgeBaseOutline, catalogSchema] = fulfilled(initialContexts);

    const result = streamText({
      model: MODEL,
      instructions: {
        role: 'system',
        content: buildInstructions(knowledgeBaseOutline, catalogSchema),
        providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
      },
      messages: await convertToModelMessages(trimHistory(allMessages)),
      tools: Object.assign({}, ...connections.map(({ tools }) => tools)),
      stopWhen: isStepCount(6),
      maxOutputTokens: 1024,
      abortSignal: req.signal,
      onEnd: closeAll,
      onAbort: closeAll,
      onError: async ({ error }) => {
        console.error('[ask] stream failed:', error);
        await closeAll();
      },
    });

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({
        stream: result.stream,
        onError: () => 'Something went wrong answering that. Please try again.',
      }),
    });
  } catch (err) {
    await closeAll();
    console.error('[ask] setup failed:', err);
    return NextResponse.json({ error: 'Ask is unavailable right now.' }, { status: 502 });
  }
}
