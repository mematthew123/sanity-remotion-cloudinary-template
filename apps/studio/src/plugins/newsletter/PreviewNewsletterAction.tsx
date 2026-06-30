import {useState} from 'react'
import type {DocumentActionComponent, DocumentActionDescription, DocumentActionProps} from 'sanity'
import {EyeOpenIcon} from '@sanity/icons'
import {useStudioUserToken} from '../../lib/useStudioClient'
import {EmailPreviewIframe} from './EmailPreviewIframe'

// Modal iframe that loads the server-rendered preview. The route reads from
// the `drafts` perspective so editors see what they're composing, not what's
// been published. EmailPreviewIframe fetches with the editor's Sanity token and
// injects the HTML via `srcDoc` — no secret in client JS, no token in the URL.
export const PreviewNewsletterAction: DocumentActionComponent = (
  props: DocumentActionProps,
): DocumentActionDescription => {
  const [open, setOpen] = useState(false)
  const userToken = useStudioUserToken()

  const baseId = (props.id || '').replace(/^drafts\./, '')
  const apiUrl =
    import.meta.env.SANITY_STUDIO_NEWSLETTER_API_URL || 'http://localhost:3000'
  const previewUrl = `${apiUrl}/api/newsletter/preview?id=${encodeURIComponent(baseId)}`

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
          content: (
            <EmailPreviewIframe url={previewUrl} token={userToken} title="Newsletter preview" />
          ),
        }
      : false,
  }
}

PreviewNewsletterAction.displayName = 'PreviewNewsletterAction'
