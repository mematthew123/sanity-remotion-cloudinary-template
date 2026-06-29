import type { Metadata } from 'next';
import Link from 'next/link';
import { draftMode } from 'next/headers';
import { JetBrains_Mono, Instrument_Serif, Inter } from 'next/font/google';
import { VisualEditing } from 'next-sanity/visual-editing';
import { SITE_URL } from '@/lib/siteUrl';
import { SanityLive } from '@/lib/sanity.live';
import NewsletterSignup from '@/components/NewsletterSignup';
import DisableDraftMode from '@/components/DisableDraftMode';
import './globals.css';

const jetbrainsMono = JetBrains_Mono({
    variable: '--font-jetbrains',
    subsets: ['latin'],
    weight: ['400', '700', '800'],
    display: 'swap',
});

const instrumentSerif = Instrument_Serif({
    variable: '--font-instrument',
    subsets: ['latin'],
    weight: ['400'],
    style: ['normal', 'italic'],
    display: 'swap',
});

const inter = Inter({
    variable: '--font-inter',
    subsets: ['latin'],
    display: 'swap',
});

export const metadata: Metadata = {
    metadataBase: new URL(SITE_URL),
    title: {
        default: 'Sanity + Remotion + Cloudinary Template',
        template: '%s | Template',
    },
    description:
        'Render videos from Sanity content with Remotion, publish to Next.js via Cloudinary.',
    alternates: {
        types: {
            'application/rss+xml': [{ url: '/feed.xml', title: 'Podcast feed' }],
        },
    },
};

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const { isEnabled: isDraftMode } = await draftMode();
    return (
        <html
            lang='en'
            className={`${jetbrainsMono.variable} ${instrumentSerif.variable} ${inter.variable}`}
        >
            <body className='flex min-h-dvh flex-col antialiased'>
                <header className='flex items-center justify-between border-b border-foreground/10 px-6 py-5'>
                    <Link
                        href='/'
                        className='font-serif text-xl tracking-tight transition-colors hover:text-accent'
                    >
                        Template
                    </Link>
                    <nav className='flex gap-8 font-mono text-xs tracking-[0.15em] text-muted uppercase'>
                        <Link href='/' className='transition-colors hover:text-foreground'>
                            Home
                        </Link>
                        <Link
                            href='/videos'
                            className='transition-colors hover:text-foreground'
                        >
                            Videos
                        </Link>
                        <Link
                            href='/playground'
                            className='transition-colors hover:text-foreground'
                        >
                            Playground
                        </Link>
                    </nav>
                </header>
                <main className='flex-1'>{children}</main>
                <footer className='border-t border-foreground/10 px-6 py-16'>
                    <div className='mx-auto max-w-2xl text-center'>
                        <span className='font-mono text-[0.7rem] tracking-[0.25em] text-accent uppercase'>
                            Newsletter
                        </span>
                        <h2 className='mt-3 font-serif text-3xl tracking-tight sm:text-4xl'>
                            One render, in your inbox
                        </h2>
                        <p className='mt-3 mb-8 font-serif text-lg/relaxed text-muted italic'>
                            Subscribe and we&apos;ll send you a rendered video — the same
                            GIF-hero email this template produces, start to finish.
                        </p>
                        <NewsletterSignup />
                    </div>
                </footer>
                {/* Live Content API: streams updates and powers draft preview. */}
                <SanityLive />
                {isDraftMode && (
                    <>
                        <VisualEditing />
                        <DisableDraftMode />
                    </>
                )}
            </body>
        </html>
    );
}
