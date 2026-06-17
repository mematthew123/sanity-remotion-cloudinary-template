import { client } from '@/lib/sanity.client';
import { POST_CAPTIONS_QUERY } from '@/lib/sanity.queries';

// WebVTT caption track for the narrated reading. Cue timings are reconstructed
// from the same per-paragraph narration chunks that drive the render: each
// chunk's `durationSeconds` advances the clock, so captions stay in lock-step
// with the audio without a separate alignment pass.

export const revalidate = 60;

function timestamp(seconds: number): string {
  const ms = Math.floor((seconds % 1) * 1000);
  const whole = Math.floor(seconds);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const post = await client.fetch(POST_CAPTIONS_QUERY, { slug });
  const chunks = post?.chunks ?? [];

  const cues: string[] = [];
  let clock = 0;
  for (const chunk of chunks) {
    const duration = chunk.durationSeconds ?? 0;
    const text = chunk.text?.trim();
    if (duration <= 0 || !text) continue;
    const start = clock;
    const end = clock + duration;
    cues.push(`${timestamp(start)} --> ${timestamp(end)}\n${text}`);
    clock = end;
  }

  const body = `WEBVTT\n\n${cues.join('\n\n')}\n`;
  return new Response(body, {
    headers: {
      'content-type': 'text/vtt; charset=utf-8',
      'cache-control': 'public, max-age=60, s-maxage=60',
    },
  });
}
