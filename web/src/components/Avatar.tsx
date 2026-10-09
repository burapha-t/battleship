/** A round badge with the first letter of a name. */
export function Avatar({ name, color }: { name: string | null; color: string }) {
  const letter = name ? [...name.trim()][0]?.toUpperCase() : undefined
  return (
    <span className="avatar" style={{ background: color }} aria-hidden>
      {letter ?? '?'}
    </span>
  )
}
