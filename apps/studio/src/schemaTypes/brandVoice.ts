import {defineField, defineType} from 'sanity'
import {SparklesIcon} from '@sanity/icons'

export const brandVoiceType = defineType({
  name: 'brandVoice',
  title: 'Brand Voice',
  type: 'document',
  icon: SparklesIcon,
  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      description: 'Shown in the "Brand AI" field menu, e.g. "Rewrite as <name>".',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {
        source: 'name',
        maxLength: 96,
      },
    }),
    defineField({
      name: 'instructions',
      title: 'Instructions',
      type: 'text',
      rows: 24,
      description:
        'Voice and tone rules (Markdown) that the Brand AI actions follow. Read live on every action.',
      validation: (rule) => rule.required(),
    }),
  ],
  orderings: [{title: 'Name (A-Z)', name: 'nameAsc', by: [{field: 'name', direction: 'asc'}]}],
  preview: {
    select: {
      title: 'name',
      subtitle: 'slug.current',
    },
  },
})
