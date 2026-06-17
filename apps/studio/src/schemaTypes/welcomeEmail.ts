import {defineField, defineType} from 'sanity'
import {RocketIcon} from '@sanity/icons'

// Singleton (document id "welcomeEmail") that drives the public newsletter
// signup. It models BOTH halves of the double-opt-in flow: the plain
// confirmation email a visitor gets on signup, and the GIF-hero welcome email
// delivered after they confirm. Registered as a singleton in
// src/structure/index.ts and hidden from the global "create" menu in
// sanity.config.ts — there is only ever one.
export const welcomeEmailType = defineType({
  name: 'welcomeEmail',
  title: 'Welcome Email',
  type: 'document',
  icon: RocketIcon,
  groups: [
    {name: 'welcome', title: 'Welcome email', default: true},
    {name: 'confirmation', title: 'Confirmation email'},
  ],
  fields: [
    defineField({
      name: 'enabled',
      title: 'Signup enabled',
      type: 'boolean',
      group: 'welcome',
      initialValue: true,
      description:
        'Master switch for the public signup form. When off, the subscribe API still accepts requests but sends nothing.',
    }),
    defineField({
      name: 'subject',
      title: 'Welcome subject line',
      type: 'string',
      group: 'welcome',
      validation: (rule) => rule.required().max(100),
    }),
    defineField({
      name: 'previewText',
      title: 'Preview text',
      type: 'string',
      group: 'welcome',
      description: 'Snippet email clients show next to the subject.',
      validation: (rule) => rule.max(150),
    }),
    defineField({
      name: 'video',
      title: 'Hero video',
      type: 'reference',
      to: [{type: 'video'}],
      group: 'welcome',
      description:
        'The rendered video whose site-preview-gif variant is the welcome email hero. Only ready videos with variants are selectable.',
      options: {
        // Same guard as the newsletter: the GIF URL the email embeds lives in
        // variants[], so a half-rendered doc would silently break the hero.
        filter: 'status == "ready" && defined(variants)',
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'post',
      title: 'Linked post',
      type: 'reference',
      to: [{type: 'post'}],
      group: 'welcome',
      description:
        "Optional. When set, the welcome email's CTA button links to this post on the site.",
    }),
    defineField({
      name: 'intro',
      title: 'Intro copy',
      type: 'blockContent',
      group: 'welcome',
      description: 'Optional short paragraph rendered above the GIF.',
    }),
    defineField({
      name: 'confirmationSubject',
      title: 'Confirmation subject line',
      type: 'string',
      group: 'confirmation',
      initialValue: 'Confirm your subscription',
      description: 'Subject of the double-opt-in email sent the moment someone signs up.',
      validation: (rule) => rule.required().max(100),
    }),
    defineField({
      name: 'confirmationBody',
      title: 'Confirmation body',
      type: 'text',
      rows: 3,
      group: 'confirmation',
      initialValue:
        'Thanks for signing up! Click the button below to confirm your email address and receive your first video.',
      description: 'A line or two of copy shown above the confirm button.',
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: {subject: 'subject', enabled: 'enabled'},
    prepare({subject, enabled}) {
      return {
        title: 'Welcome Email',
        subtitle: `${enabled === false ? '[disabled] ' : ''}${subject || 'No subject set'}`,
      }
    },
  },
})
