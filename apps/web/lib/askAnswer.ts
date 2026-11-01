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
  | { type: 'link'; link: AnswerLink };

export type Step = { id: string; label: string; state: 'active' | 'done' | 'stopped' };

export type Exchange = { id: string; question: string; answer: UIMessage | null };

const TOOL_LABELS: Record<string, { active: string; done: string }> = {
  knowledge_base_search: { active: 'Searching the knowledge base', done: 'Searched the knowledge base' },
  knowledge_base_read: { active: 'Reading knowledge base entries', done: 'Read knowledge base entries' },
  groq_query: { active: 'Querying the catalog', done: 'Queried the catalog' },
  schema_explorer: { active: 'Checking the content model', done: 'Checked the content model' },
  array_field_reader: { active: 'Reading an article', done: 'Read an article' },
};

export const URL_RE = /(https?:\/\/[^\s<>"')\]]*[^\s<>"')\].,:;!?])/g;
const URL_ONLY_RE = /^https?:\/\/\S*[^\s.,:;!?)\]]$/;
const SITE_HOST = new URL(SITE_URL).host;

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
      const done = p.state === 'output-available' || p.state === 'output-error';
      const labels = TOOL_LABELS[p.toolName];
      return {
        id: p.toolCallId,
        label: labels ? (done ? labels.done : labels.active) : p.toolName,
        state: done ? 'done' : streaming ? 'active' : 'stopped',
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
      if (
        link.kind === 'post' &&
        last?.type === 'list' &&
        last.items.at(-1)?.toLowerCase().startsWith(link.post.title.toLowerCase())
      ) {
        last.items.pop();
        if (!last.items.length) blocks.pop();
      }
      blocks.push({ type: 'link', link });
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
