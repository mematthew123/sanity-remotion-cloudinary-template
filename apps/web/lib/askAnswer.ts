import type { DynamicToolUIPart, UIMessage } from 'ai';
import { SITE_URL } from './siteUrl';

export type PostRef = { slug: string; title: string; imageUrl: string | null };

export type AnswerLink =
  | { kind: 'post'; url: string; href: string; post: PostRef }
  | { kind: 'doc'; url: string; label: string }
  | { kind: 'external'; url: string; label: string };

export type AnswerBlock =
  | { type: 'p'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'link'; link: AnswerLink; caption?: string };

export type Step = {
  id: string;
  label: string;
  state: 'active' | 'done' | 'failed' | 'stopped';
};

export type Exchange = { id: string; question: string; answer: UIMessage | null };

const TOOL_LABELS: Record<string, { active: string; done: string; failed: string }> = {
  knowledge_base_search: {
    active: 'Searching the knowledge base',
    done: 'Searched the knowledge base',
    failed: "Couldn't search the knowledge base",
  },
  knowledge_base_read: {
    active: 'Reading knowledge base entries',
    done: 'Read knowledge base entries',
    failed: "Couldn't read knowledge base entries",
  },
  groq_query: {
    active: 'Querying the catalog',
    done: 'Queried the catalog',
    failed: "Couldn't query the catalog",
  },
  schema_explorer: {
    active: 'Checking the content model',
    done: 'Checked the content model',
    failed: "Couldn't check the content model",
  },
  array_field_reader: {
    active: 'Reading an article',
    done: 'Read an article',
    failed: "Couldn't read an article",
  },
};

export const URL_RE = /(https?:\/\/[^\s<>"')\]]*[^\s<>"')\].,:;!?])/g;
const URL_ONLY_RE = /^https?:\/\/\S*[^\s.,:;!?)\]]$/;
const SITE_HOST = new URL(SITE_URL).host;
const TITLE_SEPARATOR_RE = /^(?::|\s*[–—]|\s+-\s)\s*(.+)$/;

export function exchangesOf(messages: UIMessage[]): Exchange[] {
  const exchanges: Exchange[] = [];
  for (const m of messages) {
    if (m.role === 'user') {
      const question = m.parts.map((p) => (p.type === 'text' ? p.text : '')).join('');
      exchanges.push({ id: m.id, question, answer: null });
    } else if (m.role === 'assistant' && exchanges.length) {
      exchanges[exchanges.length - 1].answer = m;
    }
  }
  return exchanges;
}

export function stepsOf(message: UIMessage, streaming: boolean): Step[] {
  return message.parts
    .filter((p): p is DynamicToolUIPart => p.type === 'dynamic-tool')
    .map((p) => {
      const state =
        p.state === 'output-available'
          ? 'done'
          : p.state === 'output-error'
            ? 'failed'
            : streaming
              ? 'active'
              : 'stopped';
      const labels = TOOL_LABELS[p.toolName];
      return {
        id: p.toolCallId,
        label: labels ? labels[state === 'stopped' ? 'active' : state] : p.toolName,
        state,
      };
    });
}

export function answerTextOf(message: UIMessage, finished: boolean): string {
  const lastTool = message.parts.findLastIndex((p) => p.type === 'dynamic-tool');
  const textFrom = (start: number) =>
    message.parts
      .map((p, i) => (p.type === 'text' && i >= start ? p.text : ''))
      .join('')
      .trim();
  const answer = textFrom(lastTool + 1);
  return answer || !finished ? answer : textFrom(0);
}

export function classifyLink(url: string, posts: PostRef[]): AnswerLink {
  let host = '';
  let hostname = '';
  let path = '';
  try {
    ({ host, hostname, pathname: path } = new URL(url));
  } catch {}
  const slug = host === SITE_HOST ? path.match(/^\/posts\/([^/]+)/)?.[1] : undefined;
  const post = slug ? posts.find((p) => p.slug === slug) : undefined;
  if (post) return { kind: 'post', url, href: `/posts/${post.slug}`, post };
  const doc = path.match(/\/docs\/([^/]+)\.md$/)?.[1];
  if (doc) return { kind: 'doc', url, label: doc.replace(/-/g, ' ') };
  return { kind: 'external', url, label: `${hostname}${path === '/' ? '' : path}` };
}

function captionAfterTitle(item: string, title: string): string | null {
  const plain = item.replace(/[*"“”]/g, '').trim();
  if (!plain.toLowerCase().startsWith(title.toLowerCase())) return null;
  const rest = plain.slice(title.length);
  if (/^[.:]?$/.test(rest.trim())) return '';
  return rest.match(TITLE_SEPARATOR_RE)?.[1] ?? null;
}

export function parseAnswer(text: string, posts: PostRef[]): AnswerBlock[] {
  const blocks: AnswerBlock[] = [];
  let paragraphOpen = false;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const last = blocks.at(-1);
    if (!line) {
      paragraphOpen = false;
    } else if (URL_ONLY_RE.test(line)) {
      const link = classifyLink(line, posts);
      const item = last?.type === 'list' ? last.items.at(-1) : undefined;
      const caption =
        link.kind === 'post' && item !== undefined ? captionAfterTitle(item, link.post.title) : null;
      if (caption !== null && last?.type === 'list') {
        last.items.pop();
        if (!last.items.length) blocks.pop();
      }
      blocks.push({ type: 'link', link, ...(caption ? { caption } : {}) });
      paragraphOpen = false;
    } else if (line.startsWith('- ')) {
      if (last?.type === 'list') last.items.push(line.slice(2));
      else blocks.push({ type: 'list', items: [line.slice(2)] });
      paragraphOpen = false;
    } else if (paragraphOpen && last?.type === 'p') {
      last.text += ` ${line}`;
    } else {
      blocks.push({ type: 'p', text: line });
      paragraphOpen = true;
    }
  }
  return blocks;
}

export function errorMessageOf(error: Error): string {
  try {
    const parsed = JSON.parse(error.message) as { error?: unknown };
    if (typeof parsed.error === 'string') return parsed.error;
  } catch {}
  return error.message || 'Something went wrong. Please try again.';
}
