import {definePlugin} from 'sanity'
import {PreviewNewsletterAction} from './PreviewNewsletterAction'
import {SendNewsletterAction} from './SendNewsletterAction'
import {PreviewWelcomeEmailAction} from './PreviewWelcomeEmailAction'

// Customises the document actions for the two email surfaces:
// - `newsletter`: replaces Publish with Preview + Send (the "publish" event for
//   a newsletter is "deliver via Resend", which Send models).
// - `welcomeEmail`: a singleton, so it keeps Publish (editors edit + publish the
//   config) but drops Duplicate/Delete; adds a Preview action.
export const newsletterPlugin = definePlugin({
  name: 'newsletter',
  document: {
    actions: (prev, context) => {
      if (context.schemaType === 'newsletter') {
        return [
          PreviewNewsletterAction,
          SendNewsletterAction,
          ...prev.filter((action) => action.action !== 'publish'),
        ]
      }
      if (context.schemaType === 'welcomeEmail') {
        return [
          PreviewWelcomeEmailAction,
          ...prev.filter(
            (action) => action.action !== 'duplicate' && action.action !== 'delete',
          ),
        ]
      }
      return prev
    },
  },
})
