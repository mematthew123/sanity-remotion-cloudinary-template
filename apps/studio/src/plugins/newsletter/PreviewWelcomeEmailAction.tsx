import {useState} from 'react'
import type {DocumentActionComponent, DocumentActionDescription, DocumentActionProps} from 'sanity'
import {EyeOpenIcon} from '@sanity/icons'
import {useStudioUserToken} from '../../lib/useStudioClient'
import {EmailPreviewIframe} from './EmailPreviewIframe'

// Modal iframe that loads the server-rendered welcome-email preview. Mirrors
// PreviewNewsletterAction, but the welcomeEmail is a singleton so there's no id
// to pass — the route reads the fixed "welcomeEmail" doc under the `drafts`
// perspective. Auth is the editor's Sanity token (see EmailPreviewIframe).
export const PreviewWelcomeEmailAction: DocumentActionComponent = (
  props: DocumentActionProps,
): DocumentActionDescription => {
  const [open, setOpen] = useState(false)
  const userToken = useStudioUserToken()

  const apiUrl =
    import.meta.env.SANITY_STUDIO_NEWSLETTER_API_URL || 'http://localhost:3000'
  const previewUrl = `${apiUrl}/api/newsletter/welcome-preview`

  return {
    label: 'Preview welcome email',
    icon: EyeOpenIcon,
    onHandle: () => setOpen(true),
    dialog: open
      ? {
          type: 'dialog',
          header: 'Welcome email preview',
          width: 'large',
          onClose: () => {
            setOpen(false)
            props.onComplete()
          },
          content: (
            <EmailPreviewIframe url={previewUrl} token={userToken} title="Welcome email preview" />
          ),
        }
      : false,
  }
}

PreviewWelcomeEmailAction.displayName = 'PreviewWelcomeEmailAction'
