import {useState} from 'react'
import type {DocumentActionComponent, DocumentActionDescription, DocumentActionProps} from 'sanity'
import {EyeOpenIcon} from '@sanity/icons'
import {Box} from '@sanity/ui'

// Modal iframe that loads the server-rendered welcome-email preview. Mirrors
// PreviewNewsletterAction, but the welcomeEmail is a singleton so there's no id
// to pass — the route reads the fixed "welcomeEmail" doc under the `drafts`
// perspective. Reuses the same NEWSLETTER secret/URL env as the newsletter
// preview (one secret guards both read-only preview routes).
export const PreviewWelcomeEmailAction: DocumentActionComponent = (
  props: DocumentActionProps,
): DocumentActionDescription => {
  const [open, setOpen] = useState(false)

  const apiUrl =
    import.meta.env.SANITY_STUDIO_NEWSLETTER_API_URL || 'http://localhost:3000'
  const secret = import.meta.env.SANITY_STUDIO_NEWSLETTER_SECRET
  const previewUrl = secret
    ? `${apiUrl}/api/newsletter/welcome-preview?secret=${encodeURIComponent(secret)}`
    : null

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
          content: previewUrl ? (
            <Box style={{height: '70vh'}}>
              <iframe
                src={previewUrl}
                style={{width: '100%', height: '100%', border: 0}}
                title="Welcome email preview"
              />
            </Box>
          ) : (
            <Box padding={4}>
              SANITY_STUDIO_NEWSLETTER_SECRET is not set. Add it to apps/studio/.env and
              restart the studio.
            </Box>
          ),
        }
      : false,
  }
}

PreviewWelcomeEmailAction.displayName = 'PreviewWelcomeEmailAction'
