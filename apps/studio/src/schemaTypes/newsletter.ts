import {defineField, defineType} from 'sanity'
import {EnvelopeIcon} from '@sanity/icons'

export const newsletterType = defineType({
  name: 'newsletter',
  title: 'Newsletter',
  type: 'document',
  icon: EnvelopeIcon,
  groups: [
    {name: 'content', title: 'Content', default: true},
    {name: 'recipients', title: 'Recipients'},
    {name: 'status', title: 'Status'},
  ],
  fields: [
    defineField({
      name: 'title',
      title: 'Internal title',
      type: 'string',
      group: 'content',
      description: 'Editor-facing name. Never shown to recipients.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'subject',
      title: 'Subject line',
      type: 'string',
      group: 'content',
      validation: (rule) => rule.required().max(100),
    }),
    defineField({
      name: 'previewText',
      title: 'Preview text',
      type: 'string',
      group: 'content',
      description: 'Snippet email clients show next to the subject.',
      validation: (rule) => rule.max(150),
    }),
    defineField({
      name: 'video',
      title: 'Hero video',
      type: 'reference',
      to: [{type: 'video'}],
      group: 'content',
      description:
        'The rendered video whose site-preview-gif variant is embedded as the email hero. Only ready videos with variants are selectable.',
      options: {
        // Picker only surfaces videos whose render finished and whose variant
        // catalog snapshot landed — the GIF URL the email depends on lives
        // inside variants[], so a half-rendered doc would silently break.
        filter: 'status == "ready" && defined(variants)',
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'post',
      title: 'Linked post',
      type: 'reference',
      to: [{type: 'post'}],
      group: 'content',
      description:
        'Optional. When set, the email\'s CTA button links to this post on the site. Omit to send a video-only blast.',
    }),
    defineField({
      name: 'intro',
      title: 'Intro copy',
      type: 'blockContent',
      group: 'content',
      description: 'Optional short paragraph rendered above the GIF.',
    }),
    defineField({
      name: 'recipientSelection',
      title: 'Recipients',
      type: 'object',
      group: 'recipients',
      validation: (rule) => rule.required(),
      fields: [
        defineField({
          name: 'selectionType',
          title: 'Send to',
          type: 'string',
          options: {
            list: [
              {title: 'Test addresses', value: 'test'},
              {title: 'Resend audience', value: 'audience'},
            ],
            layout: 'radio',
          },
          initialValue: 'test',
          validation: (rule) => rule.required(),
        }),
        defineField({
          name: 'testEmails',
          title: 'Test addresses',
          type: 'array',
          of: [{type: 'string', validation: (rule) => rule.email()}],
          hidden: ({parent}) => parent?.selectionType !== 'test',
          description:
            'One-off addresses for smoke-testing. The send route loops resend.emails.send over these — no audience needed.',
          // In test mode there must be at least one address, or the send route
          // would loop over nothing. Skipped in audience mode (field is hidden).
          validation: (rule) =>
            rule.custom((value, context) => {
              const parent = context.parent as {selectionType?: string} | undefined
              if (parent?.selectionType !== 'test') return true
              return value && value.length > 0 ? true : 'Add at least one test address'
            }),
        }),
      ],
    }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      group: 'status',
      readOnly: true,
      initialValue: 'draft',
      options: {
        list: [
          {title: 'Draft', value: 'draft'},
          {title: 'Sending', value: 'sending'},
          {title: 'Sent', value: 'sent'},
          {title: 'Failed', value: 'failed'},
        ],
        layout: 'radio',
      },
    }),
    defineField({
      name: 'sentAt',
      title: 'Sent at',
      type: 'datetime',
      group: 'status',
      readOnly: true,
    }),
    defineField({
      name: 'recipientCount',
      title: 'Recipient count',
      type: 'number',
      group: 'status',
      readOnly: true,
    }),
    defineField({
      name: 'resendBroadcastId',
      title: 'Resend broadcast ID',
      type: 'string',
      group: 'status',
      readOnly: true,
      description:
        'Resend Broadcasts returns one per audience send. Use it to fetch delivery stats from the Resend dashboard.',
    }),
  ],
  orderings: [
    {title: 'Sent (newest)', name: 'sentDesc', by: [{field: 'sentAt', direction: 'desc'}]},
  ],
  preview: {
    select: {
      title: 'title',
      subject: 'subject',
      status: 'status',
    },
    prepare({title, subject, status}) {
      const statusLabel = status && status !== 'sent' ? ` [${status.toUpperCase()}]` : ''
      return {
        title: `${title || 'Untitled newsletter'}${statusLabel}`,
        subtitle: subject || undefined,
      }
    },
  },
})
