import type { Metadata } from 'next';
import Link from 'next/link';
import { JetBrains_Mono, Instrument_Serif, Inter } from 'next/font/google';
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
    style: ['italic'],
    display: 'swap',
});

const inter = Inter({
    variable: '--font-inter',
    subsets: ['latin'],
    display: 'swap',
});

export const metadata: Metadata = {
    title: {
        default: 'Sanity + Remotion + Cloudinary Template',
        template: '%s | Template',
    },
    description:
        'Render videos from Sanity content with Remotion, publish to Next.js via Cloudinary.',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html
            lang='en'
            className={`${jetbrainsMono.variable} ${instrumentSerif.variable} ${inter.variable}`}
        >
            <body className='antialiased min-h-dvh flex flex-col'>
                <header className='flex items-center justify-between border-b border-foreground/15 px-6 py-4'>
                    <Link
                        href='/'
                        className='font-mono text-sm font-extrabold uppercase tracking-tight'
                    >
                        Template
                    </Link>
                    <nav className='flex gap-6 font-mono text-xs font-bold uppercase tracking-wide'>
                        <Link href='/' className='hover:text-accent'>
                            Home
                        </Link>
                        <Link href='/videos' className='hover:text-accent'>
                            Videos
                        </Link>
                    </nav>
                </header>
                <main className='flex-1'>{children}</main>
            </body>
        </html>
    );
}
