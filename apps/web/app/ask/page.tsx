import { notFound } from 'next/navigation';
import AskChat from '@/components/AskChat';
import { isAskEnabled, MAX_QUESTION_CHARS } from '@/lib/askConfig';
import { postImageUrl } from '@/lib/sanity.client';
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
            imageUrl: postImageUrl(post, 176, 132),
          },
        ]
      : [],
  );

  return <AskChat posts={posts} maxQuestionChars={MAX_QUESTION_CHARS} />;
}
