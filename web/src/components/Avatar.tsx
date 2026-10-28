import { SeaAvatar } from './SeaAvatar'

/** A round name badge; the default Ghost Fleet name uses its illustrated mascot. */
export function Avatar({ name, color }: { name: string | null; color: string }) {
  // The guest bot has no stored profile. Include server-deduplicated names.
  const ghost = name !== null && /^Ghost Fleet(?: \(\d+\))?$/.test(name.trim())
  const letter = name ? [...name.trim()][0]?.toUpperCase() : undefined
  return (
    <span className="avatar" style={{ background: color }} aria-hidden>
      {ghost ? <SeaAvatar code="ghost" /> : letter ?? '?'}
    </span>
  )
}
