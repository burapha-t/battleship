import { useEffect, useRef } from 'react'
import { useTranslation } from '../i18n/useTranslation'
import './QuitGameModal.css'

type Props = { onClose: () => void; onConfirm: () => void }

/** Bot-match confirmation. The native dialog element provides focus trapping and Escape handling. */
export function QuitGameModal({ onClose, onConfirm }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const keepPlaying = useRef<HTMLButtonElement>(null)
  const { t } = useTranslation('game')

  useEffect(() => {
    const restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (!dialog.current?.open) dialog.current?.showModal()
    keepPlaying.current?.focus()
    return () => restoreFocus?.focus()
  }, [])

  const dismiss = () => dialog.current?.close()

  return (
    <dialog
      ref={dialog}
      className="quit-modal"
      aria-modal="true"
      aria-labelledby="quit-modal-title"
      aria-describedby="quit-modal-description"
      onClose={onClose}
      onClick={event => {
        if (event.target !== event.currentTarget) return
        const rect = event.currentTarget.getBoundingClientRect()
        const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom
        if (outside) dismiss()
      }}
    >
      <h2 id="quit-modal-title">{t('quitGameTitle')}</h2>
      <p id="quit-modal-description">{t('quitGameDescription')}</p>
      <div className="quit-modal-actions">
        <button ref={keepPlaying} type="button" className="btn white" onClick={dismiss}>{t('keepPlaying')}</button>
        <button type="button" className="btn quit-confirm" onClick={onConfirm}>{t('quitGame')}</button>
      </div>
    </dialog>
  )
}
