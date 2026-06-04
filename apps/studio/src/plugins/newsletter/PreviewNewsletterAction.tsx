import {useState} from 'react'
import type {DocumentActionComponent, DocumentActionDescription, DocumentActionProps} from 'sanity'
import {EyeOpenIcon} from '@sanity/icons'
import {Box} from '@sanity/ui'

// Modal iframe that loads the server-rendered preview. The route reads from
// the `drafts` perspective so editors see what they're composing, not what's
// been published. Iframe is the simplest way to render an email's full HTML
// (including <Head>, inline styles, etc.) without polluting Studio's DOM.
export const PreviewNewsletterAction: DocumentActionComponent = (
  props: DocumentActionProps,
): DocumentActionDescription => {
  const [open, setOpen] = useState(false)

  const baseId = (props.id || '').replace(/^drafts\./, '')
  const apiUrl =
    import.meta.env.SANITY_STUDIO_NEWSLETTER_API_URL || 'http://localhost:3000'
  const secret = import.meta.env.SANITY_STUDIO_NEWSLETTER_SECRET
  const previewUrl = secret
    ? `${apiUrl}/api/newsletter/preview?id=${encodeURIComponent(baseId)}&secret=${encodeURIComponent(secret)}`
    : null

  return {
    label: 'Preview email',
    icon: EyeOpenIcon,
    onHandle: () => setOpen(true),
    dialog: open
      ? {
          type: 'dialog',
          header: 'Email preview',
          width: 'large',
          onClose: () => {
            setOpen(false)
            props.onComplete()
          },
          content: previewUrl ? (
            <Box style={{height: '70vh'}}>
              <iframe
                src={previewUrl}
                style={{width: '100%', height: '100%', border: 0}}
                title="Newsletter preview"
              />
            </Box>
          ) : (
            <Box padding={4}>
              SANITY_STUDIO_NEWSLETTER_SECRET is not set. Add it to
              apps/studio/.env and restart the studio.
            </Box>
          ),
        }
      : false,
  }
}

PreviewNewsletterAction.displayName = 'PreviewNewsletterAction'
