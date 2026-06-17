import type {PostVideo} from '@/lib/sanity.queries';

// Featured *video* player for the article-narrated composition: a long-form
// animated reading of the post body. Shown as a hero block on the post page
// instead of buried in the short-form video grid — the narrated reading runs
// minutes, not seconds, so it needs a different affordance than the silent
// looping promos.
//
// The audio-only version of the same narration is its own standalone feature
// (ArticleAudioPlayer) surfaced above this hero — this component is the *watch*
// affordance, that one is the *listen* affordance. Keep them decoupled.
//
// Server component — no interactivity needed. The browser's native <video>
// controls + poster handle the play/pause/seek UI for free.

interface Props {
  video: PostVideo;
  /** Used as the video's poster image until the user hits play. */
  posterUrl: string | null;
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '';
  const mins = Math.round(seconds / 60);
  return mins <= 1 ? '1 min' : `${mins} min`;
}

export default function NarratedReadingHero({video, posterUrl}: Props) {
  if (!video.cloudinaryUrl) return null;
  const durationLabel = formatDuration(video.duration);

  return (
    <section className='mb-10 overflow-hidden rounded-xl bg-foreground ring-1 ring-foreground/10 shadow-sm'>
      <div className='flex items-center justify-between gap-3 border-b border-foreground/10 bg-background px-5 py-3 font-mono text-xs tracking-[0.18em] uppercase'>
        <span className='text-accent'>▶ Watch the narrated reading</span>
        <div className='flex items-center gap-4'>
          {durationLabel && <span className='text-muted'>{durationLabel}</span>}
          {video.youtubeUrl && (
            <a
              href={video.youtubeUrl}
              download
              className='group inline-flex items-center gap-1 text-muted transition-colors hover:text-foreground'
              title='Download the full-resolution 1080p master'
            >
              1080p
              <span className='transition-transform group-hover:translate-y-0.5'>
                ↓
              </span>
            </a>
          )}
        </div>
      </div>
      <video
        src={video.cloudinaryUrl}
        controls
        preload='metadata'
        playsInline
        poster={posterUrl ?? undefined}
        // Mute autoplay isn't useful here (audio is the whole point), so
        // we don't set autoplay. The native poster handles the still frame.
        style={{
          width: '100%',
          aspectRatio: `${video.width ?? 1920}/${video.height ?? 1080}`,
          display: 'block',
        }}
      />
    </section>
  );
}
