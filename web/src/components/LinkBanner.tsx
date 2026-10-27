import { useTranslation } from '../i18n/useTranslation'
import type { Link } from '../state/useGameSocket'

/**
 * *Connecting…* until the socket is open and `connected` has arrived;
 * *Disconnected — reload* once it closes. A reload is a new player (§9).
 */
export function LinkBanner({ link, connected }: { link: Link; connected: boolean }) {
  const { t } = useTranslation('game')
  if (link === 'closed')
    return (
      <div className="link-banner closed" role="alert">
        {t('disconnected')}
        <button type="button" className="btn white small" onClick={() => window.location.reload()}>
          {t('reload')}
        </button>
      </div>
    )
  if (link === 'connecting' || !connected)
    return (
      <div className="link-banner" role="status">
        <span className="dot sun" />
        {t('connecting')}
      </div>
    )
  return null
}
