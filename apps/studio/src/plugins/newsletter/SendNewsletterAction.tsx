import {useState} from 'react'
import type {DocumentActionComponent, DocumentActionDescription, DocumentActionProps} from 'sanity'
import {useToast} from '@sanity/ui'
import {LaunchIcon} from '@sanity/icons'
import {useStudioUserToken} from '../../lib/useStudioClient'

// Mirrors `sendableReason` in apps/web/app/api/newsletter/send/route.tsx: draft
// and failed (nothing went out) are sendable, and so is a `sending` doc that was
// abandoned before any broadcast was created.
const STALE_SENDING_MS = 5 * 60 * 1000

type NewsletterSnapshot = {
  _updatedAt?: string
  resendBroadcastId?: string
  status?: 'draft' | 'sending' | 'sent' | 'failed'
  recipientSelection?: {
    selectionType?: 'test' | 'audience'
    testEmails?: string[]
  }
  subject?: string
}

export const SendNewsletterAction: DocumentActionComponent = (
  props: DocumentActionProps,
): DocumentActionDescription => {
  const toast = useToast()
  const userToken = useStudioUserToken()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isSending, setIsSending] = useState(false)

  const snapshot = (props.draft ?? props.published) as NewsletterSnapshot | null
  const status = snapshot?.status ?? 'draft'
  const selectionType = snapshot?.recipientSelection?.selectionType
  const testEmailCount = snapshot?.recipientSelection?.testEmails?.length ?? 0

  // Disable when the doc isn't in a sendable state. Defense in depth — the
  // route enforces the same precondition, but disabling here keeps the editor
  // from clicking expecting an action.
  const staleSending =
    status === 'sending' &&
    !snapshot?.resendBroadcastId &&
    Date.now() - new Date(snapshot?._updatedAt ?? 0).getTime() > STALE_SENDING_MS
  const disabledReason =
    status === 'sent'
      ? 'Already sent to the audience. Create a new newsletter to send again.'
      : status === 'sending' && !staleSending
      ? 'Sending in progress.'
      : !selectionType
      ? 'Pick a recipient selection type first'
      : selectionType === 'test' && testEmailCount === 0
      ? 'Add at least one test address first'
      : null

  const baseId = (props.id || '').replace(/^drafts\./, '')
  const apiUrl =
    import.meta.env.SANITY_STUDIO_NEWSLETTER_API_URL || 'http://localhost:3000'

  const onConfirm = async () => {
    setConfirmOpen(false)

    if (!userToken) {
      toast.push({
        status: 'error',
        title: 'No Sanity session token available — sign in again.',
      })
      props.onComplete()
      return
    }

    setIsSending(true)
    try {
      const res = await fetch(`${apiUrl}/api/newsletter/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          documentId: baseId,
          confirmAudienceSend: selectionType === 'audience',
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        ok?: boolean
        mode?: string
        recipientCount?: number
        resendBroadcastId?: string
        warning?: string
      }
      if (res.ok && data.ok) {
        toast.push({
          status: data.warning ? 'warning' : 'success',
          description: data.warning,
          title:
            data.mode === 'audience'
              ? `Broadcast scheduled (${data.resendBroadcastId})`
              : `Test sent to ${data.recipientCount} address${data.recipientCount === 1 ? '' : 'es'}`,
        })
      } else {
        toast.push({
          status: 'error',
          title: 'Send failed',
          description: data.error || res.statusText,
        })
      }
    } catch (err) {
      toast.push({
        status: 'error',
        title: 'Send request failed',
        description: err instanceof Error ? err.message : 'Network error',
      })
    } finally {
      setIsSending(false)
      props.onComplete()
    }
  }

  return {
    label: 'Send newsletter',
    icon: LaunchIcon,
    disabled: isSending || disabledReason !== null,
    title: disabledReason ?? undefined,
    onHandle: () => setConfirmOpen(true),
    dialog: confirmOpen
      ? {
          type: 'confirm',
          tone: selectionType === 'audience' ? 'critical' : 'caution',
          message:
            selectionType === 'audience'
              ? 'Send to the full Resend audience? This cannot be undone — Resend will deliver within the next minute.'
              : `Send a test to ${testEmailCount} address${testEmailCount === 1 ? '' : 'es'}?`,
          onConfirm,
          onCancel: () => {
            setConfirmOpen(false)
            props.onComplete()
          },
        }
      : false,
  }
}

SendNewsletterAction.displayName = 'SendNewsletterAction'
