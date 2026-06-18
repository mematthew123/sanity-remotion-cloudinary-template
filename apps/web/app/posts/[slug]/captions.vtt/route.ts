import { client } from '@/lib/sanity.client';
import { POST_CAPTIONS_QUERY } from '@/lib/sanity.queries';
import { buildVtt } from '@/lib/captions';

// WebVTT caption track for the narrated reading. Cues come from the same
// narration chunks that drive the render: word-level when ElevenLabs forced
// alignment has run (grouped into short readable lines), paragraph-level
// otherwise. Either way each chunk's `durationSeconds` advances the clock, so
// captions stay in lock-step with the audio.

export const revalidate = 60;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const post = await client.fetch(POST_CAPTIONS_QUERY, { slug });

  const body = buildVtt(post?.chunks ?? []);
  return new Response(body, {
    headers: {
      'content-type': 'text/vtt; charset=utf-8',
      'cache-control': 'public, max-age=60, s-maxage=60',
    },
  });
}
