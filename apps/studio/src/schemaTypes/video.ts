import {defineArrayMember, defineField, defineType} from 'sanity'
import {PlayIcon} from '@sanity/icons'
import {COMPOSITIONS} from '@template/video-core/registry'

// `article-narrated` is gated on ElevenLabs being set up — keep it out of the
// template picker unless the narrated feature is enabled (see sanity.config.ts).
const narratedEnabled = import.meta.env.SANITY_STUDIO_ENABLE_NARRATED === 'true'
const selectableCompositions = COMPOSITIONS.filter(
  (c) => narratedEnabled || c.id !== 'article-narrated',
)

export const videoType = defineType({
  name: 'video',
  title: 'Video',
  type: 'document',
  icon: PlayIcon,
  groups: [
    {name: 'video', title: 'Video', default: true},
    {name: 'technical', title: 'Technical'},
  ],
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      group: 'video',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'cloudinaryPublicId',
      title: 'Cloudinary Public ID',
      type: 'string',
      group: 'technical',
      readOnly: true,
      description: 'Populated automatically after Cloudinary upload',
    }),
    defineField({
      name: 'cloudinaryUrl',
      title: 'Cloudinary URL',
      type: 'url',
      group: 'technical',
      readOnly: true,
      description: 'Direct URL for video playback from Cloudinary CDN',
    }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      group: 'technical',
      options: {
        list: [
          {title: 'Rendering', value: 'rendering'},
          {title: 'Uploading to Cloudinary', value: 'uploading'},
          {title: 'Ready', value: 'ready'},
          {title: 'Failed', value: 'failed'},
        ],
        layout: 'radio',
      },
      initialValue: 'rendering',
      readOnly: true,
      description: 'Current state of the video pipeline',
    }),
    defineField({
      name: 'errorMessage',
      title: 'Error Message',
      type: 'string',
      group: 'technical',
      readOnly: true,
      hidden: ({value}) => !value,
      description: 'Error details if status is "failed"',
    }),
    defineField({
      name: 'post',
      title: 'Blog Post',
      type: 'reference',
      to: [{type: 'post'}],
      group: 'video',
      description: 'The blog post this video was generated from',
    }),
    defineField({
      name: 'format',
      title: 'Format',
      type: 'string',
      group: 'video',
      options: {
        list: [{title: 'MP4', value: 'mp4'}],
        layout: 'radio',
      },
      initialValue: 'mp4',
    }),
    defineField({
      name: 'template',
      title: 'Template',
      type: 'string',
      group: 'video',
      description: 'Composition the renderer will use.',
      options: {
        // Show duration in the option label so editors can pick by length.
        list: selectableCompositions.map((c) => {
          const seconds = Math.round(c.defaultDurationFrames / c.fps)
          return {title: `${c.label} — ${seconds}s`, value: c.id}
        }),
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'duration',
      title: 'Duration (seconds)',
      type: 'number',
      group: 'video',
    }),
    defineField({
      name: 'width',
      title: 'Width',
      type: 'number',
      group: 'technical',
    }),
    defineField({
      name: 'height',
      title: 'Height',
      type: 'number',
      group: 'technical',
    }),
    defineField({
      name: 'variants',
      title: 'Variants',
      type: 'array',
      group: 'technical',
      readOnly: true,
      description: 'Cloudinary derivatives generated at render time.',
      of: [
        defineArrayMember({
          type: 'object',
          fields: [
            defineField({name: 'variantId', title: 'Variant ID', type: 'string'}),
            defineField({name: 'surface', title: 'Surface', type: 'string'}),
            defineField({name: 'format', title: 'Format', type: 'string'}),
            defineField({name: 'url', title: 'URL', type: 'url'}),
            defineField({name: 'width', title: 'Width', type: 'number'}),
            defineField({name: 'height', title: 'Height', type: 'number'}),
          ],
          preview: {
            select: {title: 'variantId', surface: 'surface', format: 'format'},
            prepare({title, surface, format}) {
              const meta = [surface, format].filter(Boolean).join(' · ')
              return {title: title || 'Variant', subtitle: meta || undefined}
            },
          },
        }),
      ],
    }),
    defineField({
      name: 'renderStartedAt',
      title: 'Render Started At',
      type: 'datetime',
      group: 'technical',
      readOnly: true,
      description:
        'Set when the doc enters status "rendering". The render route reclaims docs still "rendering"/"uploading" past the render ceiling — i.e. whose function was killed mid-render and never reached "failed" — marking them failed on the next render request for this post + template.',
    }),
    defineField({
      name: 'renderedAt',
      title: 'Rendered At',
      type: 'datetime',
      group: 'technical',
      readOnly: true,
    }),
    defineField({
      name: 'inputProps',
      title: 'Input Props',
      type: 'text',
      group: 'technical',
      readOnly: true,
      description: 'JSON snapshot of the props used to render this video',
    }),
  ],
  orderings: [
    {title: 'Newest First', name: 'renderedDesc', by: [{field: 'renderedAt', direction: 'desc'}]},
    {title: 'Status', name: 'statusAsc', by: [{field: 'status', direction: 'asc'}]},
  ],
  preview: {
    select: {
      title: 'title',
      template: 'template',
      status: 'status',
    },
    prepare({title, template, status}) {
      const statusLabel =
        status === 'ready'
          ? ''
          : status === 'failed'
            ? ' [FAILED]'
            : ` [${(status ?? 'unknown').toUpperCase()}]`
      return {
        title: `${title || 'Untitled Video'}${statusLabel}`,
        subtitle: template || undefined,
        media: PlayIcon,
      }
    },
  },
})
