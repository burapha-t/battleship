import { useEffect, useRef } from 'react'
import './ScreenHead.css'

type Props = {
  title: string
  subtitle: string
  /** The Home button's text, in the screen's language. */
  home: string
  onHome: () => void
}

/**
 * The top row of a screen opened from the lobby (profile, leaderboard,
 * badges): a tilted title, a subtitle beside it, and Home at the right,
 * lined up with the header's settings icon. Focus moves to the title when
 * the screen opens.
 */
export function ScreenHead({ title, subtitle, home, onHome }: Props) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus(), [])

  return (
    <div className="screen-head">
      <h1 ref={heading} tabIndex={-1} className="title">{title}</h1>
      <span className="screen-sub">{subtitle}</span>
      <button type="button" className="btn white small" onClick={onHome}>
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M3 11.5 12 4l9 7.5" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5.5 10v9.5h13V10" fill="#fff" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
          <rect x="10" y="13.5" width="4" height="6" rx="1" fill="var(--sun)" stroke="currentColor" strokeWidth="2" />
        </svg>
        {home}
      </button>
    </div>
  )
}
