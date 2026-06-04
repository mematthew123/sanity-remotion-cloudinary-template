import {definePlugin} from 'sanity'
import {PreviewNewsletterAction} from './PreviewNewsletterAction'
import {SendNewsletterAction} from './SendNewsletterAction'

// Replaces the default Publish action on `newsletter` docs with two custom
// actions: Preview (renders the email in a modal iframe) and Send (POSTs to
// /api/newsletter/send). Publish doesn't make sense for newsletters — the
// "publish" event is "deliver via Resend", which our Send action models.
export const newsletterPlugin = definePlugin({
  name: 'newsletter',
  document: {
    actions: (prev, context) => {
      if (context.schemaType !== 'newsletter') return prev
      return [
        PreviewNewsletterAction,
        SendNewsletterAction,
        ...prev.filter((action) => action.action !== 'publish'),
      ]
    },
  },
})
