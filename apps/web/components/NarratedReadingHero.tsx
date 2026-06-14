import type {Video} from '@/lib/sanity.queries';

// Featured player for the article-narrated composition: a long-form narrated
// reading of the post body. Shown as a hero block on the post page instead
// of buried in the short-form video grid — the narrated reading has audio
// and runs minutes, not seconds, so it needs a different affordance than the
// silent looping promos.
//
// Server component — no interactivity needed. The browser's native <video>
// controls + poster handle the play/pause/seek UI for free.

interface Props {
  video: Video;
  /** Used as the video's poster image until the user hits play. */
  posterUrl: string | null;
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '';
  const mins = Math.round(seconds / 60);
  return mins <= 1 ? '1 min listen' : `${mins} min listen`;
}

export default function NarratedReadingHero({video, posterUrl}: Props) {
  if (!video.cloudinaryUrl) return null;
  const durationLabel = formatDuration(video.duration);

  return (
    <section className='mb-10 border-[3px] border-foreground bg-foreground shadow-[6px_6px_0px_var(--color-foreground)]'>
      <div className='flex items-center justify-between gap-3 border-b-[3px] border-foreground bg-background px-4 py-2 font-mono text-xs font-extrabold uppercase tracking-[0.1em]'>
        <span className='text-foreground'>
          ▶ Listen to this article
        </span>
        {durationLabel && (
          <span className='text-muted'>{durationLabel}</span>
        )}
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
      {/* Audio-only version: the same narration, served by Cloudinary as an
          MP3 sliced from the canonical render (the `podcast-mp3` variant — no
          re-render). For listening without watching, or taking it offline. */}
      {video.podcastUrl && (
        <div className='flex flex-wrap items-center justify-between gap-3 border-t-[3px] border-foreground bg-background px-4 py-3'>
          <span className='font-mono text-xs font-extrabold uppercase tracking-[0.1em] text-foreground'>
            🎧 Audio version
          </span>
          <audio
            src={video.podcastUrl}
            controls
            preload='none'
            className='h-9 min-w-0 flex-1 sm:max-w-md'
          />
          <a
            href={video.podcastUrl}
            download
            className='font-mono text-xs font-bold uppercase tracking-wide text-foreground underline underline-offset-2 hover:text-muted'
          >
            ↓ MP3
          </a>
        </div>
      )}
    </section>
  );
}
