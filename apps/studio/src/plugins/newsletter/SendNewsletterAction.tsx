import {useState} from 'react'
import type {DocumentActionComponent, DocumentActionDescription, DocumentActionProps} from 'sanity'
import {useToast} from '@sanity/ui'
import {LaunchIcon} from '@sanity/icons'

type NewsletterSnapshot = {
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
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isSending, setIsSending] = useState(false)

  const snapshot = (props.draft ?? props.published) as NewsletterSnapshot | null
  const status = snapshot?.status ?? 'draft'
  const selectionType = snapshot?.recipientSelection?.selectionType
  const testEmailCount = snapshot?.recipientSelection?.testEmails?.length ?? 0

  // Disable when the doc isn't in a sendable state. Defense in depth — the
  // route enforces the same precondition, but disabling here keeps the editor
  // from clicking expecting an action.
  const disabledReason =
    status !== 'draft'
      ? `Already ${status}. Duplicate this doc to send again.`
      : !selectionType
      ? 'Pick a recipient selection type first'
      : selectionType === 'test' && testEmailCount === 0
      ? 'Add at least one test address first'
      : null

  const baseId = (props.id || '').replace(/^drafts\./, '')
  const apiUrl =
    import.meta.env.SANITY_STUDIO_NEWSLETTER_API_URL || 'http://localhost:3000'
  const secret = import.meta.env.SANITY_STUDIO_NEWSLETTER_SECRET

  const onConfirm = async () => {
    setConfirmOpen(false)

    if (!secret) {
      toast.push({status: 'error', title: 'SANITY_STUDIO_NEWSLETTER_SECRET not set'})
      props.onComplete()
      return
    }

    setIsSending(true)
    try {
      const res = await fetch(`${apiUrl}/api/newsletter/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secret}`,
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
      }
      if (res.ok && data.ok) {
        toast.push({
          status: 'success',
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
