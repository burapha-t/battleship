import type { Link } from '../useGameSocket'

/**
 * *Connecting…* until the socket is open and `connected` has arrived;
 * *Disconnected — reload* once it closes. A reload is a new player (§9).
 */
export function LinkBanner({ link, connected }: { link: Link; connected: boolean }) {
  if (link === 'closed')
    return (
      <div className="link-banner closed" role="alert">
        Disconnected — reload
        <button type="button" className="btn white small" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    )
  if (link === 'connecting' || !connected)
    return (
      <div className="link-banner" role="status">
        <span className="dot sun" />
        Connecting…
      </div>
    )
  return null
}
