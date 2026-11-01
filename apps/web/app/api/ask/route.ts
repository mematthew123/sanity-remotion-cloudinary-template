import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from 'ai';
import { NextRequest, NextResponse } from 'next/server';
import {
  isAskEnabled,
  SANITY_CONTEXT_ASSISTANT_URL,
  SANITY_CONTEXT_CATALOG_URL,
} from '@/lib/askConfig';
import { isRateLimited } from '@/lib/askThrottle';
import { connectContextTools, getInitialContext } from '@/lib/sanityContext';
import { SITE_URL } from '@/lib/siteUrl';

export const maxDuration = 60;

const MODEL = 'anthropic/claude-haiku-4.5';
const MAX_MESSAGES = 12;
const MAX_QUESTION_CHARS = 1500;

function buildInstructions(knowledgeBaseOutline: string, catalogSchema: string): string {
  return [
    'You answer visitors\' questions about this site: the articles it publishes and the videos rendered from them.',
    '',
    'You have two read-only sources:',
    '- Knowledge Base tools (`knowledge_base_search`, `knowledge_base_read`): reconciled facts and explanations drawn from the articles and the project docs. Use these first for what/why/how questions.',
    `- Catalog tools (\`groq_query\`, \`schema_explorer\`, \`array_field_reader\`): the live posts and videos. Use these for lists, dates, links, and video URLs. A post lives at ${SITE_URL}/posts/<slug.current>.`,
    '',
    'Answer only from what these tools return. If they do not cover the question, say so plainly instead of guessing.',
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

function questionLength(message: UIMessage): number {
  return message.parts.reduce(
    (total, part) => total + (part.type === 'text' ? part.text.length : 0),
    0,
  );
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

  const body = (await req.json().catch(() => ({}))) as { messages?: UIMessage[] };
  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-MAX_MESSAGES);
  const question = messages.at(-1);
  if (!question || question.role !== 'user') {
    return NextResponse.json({ error: 'Ask a question.' }, { status: 400 });
  }
  if (questionLength(question) > MAX_QUESTION_CHARS) {
    return NextResponse.json(
      { error: `Keep questions under ${MAX_QUESTION_CHARS} characters.` },
      { status: 400 },
    );
  }

  const urls = [SANITY_CONTEXT_ASSISTANT_URL!, SANITY_CONTEXT_CATALOG_URL!];
  const connections = await Promise.all(urls.map(connectContextTools));
  const closeAll = async () => {
    await Promise.allSettled(connections.map(({ client }) => client.close()));
  };

  try {
    const [knowledgeBaseOutline, catalogSchema] = await Promise.all(urls.map(getInitialContext));

    const result = streamText({
      model: MODEL,
      instructions: {
        role: 'system',
        content: buildInstructions(knowledgeBaseOutline, catalogSchema),
        providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
      },
      messages: await convertToModelMessages(messages),
      tools: Object.assign({}, ...connections.map(({ tools }) => tools)),
      stopWhen: isStepCount(6),
      maxOutputTokens: 1024,
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
