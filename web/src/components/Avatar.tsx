import { SeaAvatar } from './SeaAvatar'

/**
 * A round name badge: the player's saved picture when `avatar` is set (#77),
 * otherwise the name's first letter; the default Ghost Fleet name uses its
 * illustrated mascot.
 */
export function Avatar({ name, color, avatar = '' }: { name: string | null; color: string; avatar?: string }) {
  // The guest bot has no stored profile. Include server-deduplicated names.
  const ghost = name !== null && /^Ghost Fleet(?: \(\d+\))?$/.test(name.trim())
  const letter = name ? [...name.trim()][0]?.toUpperCase() : undefined
  return (
    <span className="avatar" style={{ background: color }} aria-hidden>
      {avatar ? <SeaAvatar code={avatar} /> : ghost ? <SeaAvatar code="ghost" /> : letter ?? '?'}
    </span>
  )
}
