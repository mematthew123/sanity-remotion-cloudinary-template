import Link from 'next/link';
import { GITHUB_REPO_URL } from '@/lib/links';
import { client, urlFor } from '@/lib/sanity.client';
import { ALL_POSTS_QUERY } from '@/lib/sanity.queries';
import VideoHoverPreview from '@/components/VideoHoverPreview';

export const revalidate = 60;

// One canonical render branching into the four delivery surfaces — the visual
// shorthand for "render once, derive infinitely". Pure SVG, no deps.
function FanoutDiagram() {
  const targets = ['Site', 'Email', 'YouTube', 'Podcast'];
  const ys = [22, 54, 86, 118];
  return (
    <svg
      viewBox='0 0 220 140'
      className='mt-6 w-full max-w-[240px] text-accent'
      role='img'
      aria-label='One render fans out to the site, email, YouTube, and podcast'
    >
      {ys.map((y) => (
        <path
          key={y}
          d={`M40 70 C 90 70, 90 ${y}, 128 ${y}`}
          fill='none'
          stroke='currentColor'
          strokeWidth='1.5'
          opacity='0.5'
        />
      ))}
      <circle cx='34' cy='70' r='8' fill='currentColor' />
      <text
        x='34'
        y='94'
        textAnchor='middle'
        className='fill-muted font-mono text-[8px] tracking-wide uppercase'
      >
        1 render
      </text>
      {ys.map((y, i) => (
        <g key={targets[i]}>
          <circle cx='132' cy={y} r='4' fill='currentColor' />
          <text
            x='144'
            y={y + 3}
            className='fill-foreground font-mono text-[9px] tracking-wide'
          >
            {targets[i]}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default async function HomePage() {
  const posts = await client.fetch(ALL_POSTS_QUERY);

  const cards = posts.map((post) => ({
    id: post._id,
    href: post.slug?.current ? `/posts/${post.slug.current}` : null,
    imageUrl: post.mainImage
      ? urlFor(post.mainImage).width(800).height(450).fit('crop').url()
      : (post.preview?.posterUrl ?? null),
    previewGifUrl: post.preview?.previewGifUrl ?? null,
    imageAlt: post.mainImage?.alt ?? post.title ?? '',
    title: post.title ?? 'Untitled',
    excerpt: post.excerpt ?? null,
    authorName: post.authorName ?? 'Unknown',
    dateLabel: post.publishedAt
      ? new Date(post.publishedAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          timeZone: 'UTC',
        })
      : null,
  }));

  return (
    <div className='mx-auto max-w-5xl px-6 py-20'>
      <section className='mb-20 border-b border-foreground/10 pb-16'>
        <span className='font-mono text-[0.7rem] tracking-[0.25em] text-accent uppercase'>
          Render once · publish everywhere
        </span>
        <h1 className='mt-5 max-w-3xl font-serif text-5xl leading-[1.05] tracking-tight text-balance sm:text-6xl'>
          Turn your writing into video, automatically.
        </h1>
        <p className='mt-6 max-w-xl font-serif text-xl/relaxed text-muted italic'>
          Sanity content becomes Remotion video, delivered through Cloudinary and
          published here — all from a single click in the Studio.
        </p>
        <div className='mt-9 flex flex-wrap items-center gap-6'>
          <a
            href={GITHUB_REPO_URL}
            target='_blank'
            rel='noreferrer'
            className='group inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90'
          >
            <span>View the source on GitHub</span>
            <span className='transition-transform group-hover:translate-x-1'>→</span>
          </a>
          <Link
            href='/videos'
            className='group inline-flex items-center gap-2 text-sm font-medium text-foreground'
          >
            <span className='border-b border-foreground/30 pb-0.5 transition-colors group-hover:border-foreground'>
              Browse all videos
            </span>
            <span className='transition-transform group-hover:translate-x-1'>→</span>
          </Link>
        </div>
      </section>

      <section className='mb-20 border-b border-foreground/10 pb-16'>
        <h2 className='mb-10 font-mono text-xs tracking-[0.2em] text-muted uppercase'>
          How it works
        </h2>
        <ol className='grid grid-cols-1 gap-10 sm:grid-cols-3'>
          {[
            {
              step: '01',
              name: 'Sanity authors',
              body: 'Write the post and trigger a render with one click in the Studio. Content is the only source of truth.',
            },
            {
              step: '02',
              name: 'Remotion renders',
              body: 'A sandboxed render turns that content into one canonical MP4 — the single expensive step, run exactly once.',
            },
            {
              step: '03',
              name: 'Cloudinary delivers',
              body: 'That one render fans out into every surface — site player, email GIF, YouTube, podcast — as cheap derivations.',
            },
          ].map((item) => (
            <li key={item.step}>
              <div className='font-mono text-xs tracking-[0.2em] text-accent'>
                {item.step}
              </div>
              <h3 className='mt-3 font-serif text-2xl/tight tracking-tight'>
                {item.name}
              </h3>
              <p className='mt-3 leading-relaxed text-muted'>{item.body}</p>
              {item.step === '03' && <FanoutDiagram />}
            </li>
          ))}
        </ol>
      </section>

      <h2 className='mb-10 font-mono text-xs tracking-[0.2em] text-muted uppercase'>
        Latest writing
      </h2>

      {cards.length === 0 ? (
        <p className='text-muted'>Nothing here yet.</p>
      ) : (
        <ul className='flex flex-col'>
          {cards.map((card, i) => {
            const inner = (
              <article
                className={`group grid grid-cols-1 gap-8 py-10 sm:grid-cols-[1fr_320px] ${
                  i !== 0 ? 'border-t border-foreground/10' : ''
                }`}
              >
                <div className='flex flex-col justify-center'>
                  {card.dateLabel && (
                    <div className='mb-3 font-mono text-xs tracking-wide text-muted uppercase'>
                      {card.authorName} · {card.dateLabel}
                    </div>
                  )}
                  <h3 className='font-serif text-3xl/tight tracking-tight transition-colors group-hover:text-accent'>
                    {card.title}
                  </h3>
                  {card.excerpt && (
                    <p className='mt-3 max-w-prose leading-relaxed text-muted'>
                      {card.excerpt}
                    </p>
                  )}
                  <span className='mt-5 inline-flex items-center gap-1.5 font-mono text-xs tracking-wide text-foreground/60 uppercase transition-colors group-hover:text-foreground'>
                    Read article
                    <span className='transition-transform group-hover:translate-x-1'>
                      →
                    </span>
                  </span>
                </div>
                {(card.imageUrl || card.previewGifUrl) && (
                  <div className='relative aspect-4/3 w-full overflow-hidden rounded-lg bg-muted/10 sm:order-last'>
                    <VideoHoverPreview
                      imageUrl={card.imageUrl}
                      gifUrl={card.previewGifUrl}
                      imageAlt={card.imageAlt}
                      sizes='(max-width: 640px) 100vw, 320px'
                    />
                  </div>
                )}
              </article>
            );
            return (
              <li key={card.id}>
                {card.href ? <Link href={card.href}>{inner}</Link> : inner}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
