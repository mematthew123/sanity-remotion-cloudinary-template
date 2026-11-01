import { notFound } from 'next/navigation';
import AskChat from '@/components/AskChat';
import { isAskEnabled, MAX_QUESTION_CHARS } from '@/lib/askConfig';
import { urlFor } from '@/lib/sanity.client';
import { sanityFetch } from '@/lib/sanity.live';
import { ALL_POSTS_QUERY } from '@/lib/sanity.queries';

export const metadata = {
  title: 'Ask',
  description:
    'Ask about the articles, their videos, or the template behind the site, answered from a Sanity Context Knowledge Base.',
};

export default async function AskPage() {
  if (!isAskEnabled()) notFound();

  const { data } = await sanityFetch({ query: ALL_POSTS_QUERY });
  const posts = data.flatMap((post) =>
    post.slug?.current
      ? [
          {
            slug: post.slug.current,
            title: post.title ?? 'Untitled',
            imageUrl: post.mainImage
              ? urlFor(post.mainImage).width(176).height(132).fit('crop').url()
              : (post.preview?.posterUrl ?? null),
          },
        ]
      : [],
  );

  return <AskChat posts={posts} maxQuestionChars={MAX_QUESTION_CHARS} />;
}
