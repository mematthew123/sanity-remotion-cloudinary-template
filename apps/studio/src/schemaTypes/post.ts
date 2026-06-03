import {defineField, defineType} from 'sanity'
import {DocumentTextIcon, SparklesIcon} from '@sanity/icons'

export const postType = defineType({
  name: 'post',
  title: 'Post',
  type: 'document',
  icon: DocumentTextIcon,
  groups: [
    {name: 'content', title: 'Content', default: true},
    {name: 'video', title: 'Video'},
    {name: 'settings', title: 'Settings'},
  ],
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      group: 'content',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      group: 'content',
      options: {
        source: 'title',
        maxLength: 96,
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'author',
      title: 'Author',
      type: 'reference',
      group: 'content',
      to: {type: 'author'},
    }),
    defineField({
      name: 'excerpt',
      title: 'Excerpt',
      type: 'text',
      group: 'content',
      rows: 3,
      description: 'Short summary shown in listings and used as copy in rendered videos.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'mainImage',
      title: 'Main image',
      type: 'image',
      group: 'content',
      options: {
        hotspot: true,
      },
    }),
    defineField({
      name: 'publishedAt',
      title: 'Published at',
      type: 'datetime',
      group: 'content',
      initialValue: () => new Date().toISOString(),
    }),
    defineField({
      name: 'body',
      title: 'Body',
      type: 'blockContent',
      group: 'content',
    }),
    defineField({
      name: 'voice',
      title: 'Brand voice',
      type: 'reference',
      group: 'settings',
      to: [{type: 'sanity.agentContext'}],
      icon: SparklesIcon,
      description:
        'Which brand voice the AI field actions use on this post. Manage voices under "Brand Voices" in the sidebar. Leave empty to fall back to the default "brand-voice".',
      options: {
        // Don't let editors create blank agent-context docs from the post picker —
        // voices are authored via Studio's "Brand Voices" list (or seeded from
        // apps/studio/voices/*.md by scripts/seed-agent-context.ts).
        disableNew: true,
      },
    }),
    defineField({
      name: 'videoCopy',
      title: 'Video copy',
      type: 'object',
      group: 'video',
      description:
        'Short copy slots used when rendering this post into a video. Use the "Generate video copy in brand voice" AI action to fill these from the article.',
      options: {collapsible: true, collapsed: true},
      fields: [
        defineField({
          name: 'kicker',
          title: 'Kicker',
          type: 'string',
          description: 'Short label above the headline (max 3 words).',
        }),
        defineField({
          name: 'headline',
          title: 'Headline',
          type: 'string',
          description: 'Punchy on-screen headline (max 8 words). May differ from the post title.',
        }),
        defineField({
          name: 'subhead',
          title: 'Subhead',
          type: 'string',
          description: 'One supporting line (max 12 words).',
        }),
        defineField({
          name: 'pullQuote',
          title: 'Pull quote',
          type: 'text',
          rows: 2,
          description: 'A short standout line drawn from the article (max 16 words).',
        }),
        defineField({
          name: 'ctaPrimary',
          title: 'CTA (primary)',
          type: 'string',
          description: 'Primary call to action (max 4 words, e.g. "Read more").',
        }),
        defineField({
          name: 'ctaSecondary',
          title: 'CTA (secondary)',
          type: 'string',
          description: 'Optional secondary call to action (max 6 words).',
        }),
      ],
    }),
  ],
  orderings: [
    {
      title: 'Published (Newest)',
      name: 'publishedDesc',
      by: [{field: 'publishedAt', direction: 'desc'}],
    },
    {title: 'Title (A-Z)', name: 'titleAsc', by: [{field: 'title', direction: 'asc'}]},
  ],
  preview: {
    select: {
      title: 'title',
      author: 'author.name',
      media: 'mainImage',
    },
    prepare({title, author, media}) {
      return {
        title,
        subtitle: author ? `by ${author}` : undefined,
        media,
      }
    },
  },
})
