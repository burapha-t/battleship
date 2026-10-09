/** The big title and ship drawing on the nickname and lobby screens. */
export function Hero() {
  return (
    <section className="hero">
      <h1>Battleship</h1>
      <p>Hide your fleet, take a shot every 10 seconds, and sink all 4 enemy ships first.</p>
      <svg viewBox="0 0 460 300" aria-hidden>
        <g stroke="#14325A" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round">
          <circle cx="300" cy="46" r="18" fill="#fff" />
          <circle cx="330" cy="26" r="13" fill="#fff" />
          <circle cx="352" cy="12" r="8" fill="#fff" />
          <rect x="262" y="70" width="44" height="78" rx="8" fill="#FFC83D" />
          <rect x="262" y="88" width="44" height="14" fill="#FF4F5E" />
          <rect x="150" y="110" width="150" height="64" rx="12" fill="#fff" />
          <circle cx="186" cy="142" r="11" fill="#9CCDF3" />
          <circle cx="226" cy="142" r="11" fill="#9CCDF3" />
          <circle cx="266" cy="142" r="11" fill="#9CCDF3" />
          <line x1="120" y1="40" x2="120" y2="172" />
          <path d="M124 48 L176 66 L124 84 Z" fill="#FF4F5E" />
          <path d="M40 172 H420 L380 250 H86 Z" fill="#FF4F5E" />
          <path d="M52 196 H408" />
          <circle cx="130" cy="220" r="9" fill="#fff" />
          <circle cx="190" cy="220" r="9" fill="#fff" />
          <circle cx="250" cy="220" r="9" fill="#fff" />
          <circle cx="310" cy="220" r="9" fill="#fff" />
        </g>
        <path d="M10 262 Q 50 240 90 262 T 170 262 T 250 262 T 330 262 T 410 262 T 460 258" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
        <path d="M10 262 Q 50 240 90 262 T 170 262 T 250 262 T 330 262 T 410 262 T 460 258" fill="none" stroke="#14325A" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </section>
  )
}
