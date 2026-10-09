// Sound effects, synthesised with the Web Audio API so there are no audio
// files to license. Mute is remembered in localStorage.

export type Sound = 'hit' | 'miss' | 'sunk' | 'win' | 'lose'

const MUTE_KEY = 'battleship.muted'

let muted = readMuted()
let audio: AudioContext | null = null

// Browsers block audio until the player interacts with the page, so the
// context is only created on the first click or key press.
if (typeof window !== 'undefined') {
  const unlock = () => {
    audio ??= new AudioContext()
    void audio.resume()
  }
  window.addEventListener('pointerdown', unlock, { once: true })
  window.addEventListener('keydown', unlock, { once: true })
}

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false // storage blocked (private window, file://, …): default to sound on
  }
}

export function isMuted(): boolean {
  return muted
}

export function setMuted(value: boolean): void {
  muted = value
  try {
    localStorage.setItem(MUTE_KEY, value ? '1' : '0')
  } catch {
    // Not remembered, but still applies for this page.
  }
}

export function playSound(sound: Sound): void {
  const ctx = audio
  if (muted || !ctx) return
  const t = ctx.currentTime
  switch (sound) {
    case 'hit':
      noise(ctx, t, 0.35, 1200, 0.5)
      tone(ctx, t, 160, 45, 0.3, 'square', 0.18)
      break
    case 'miss':
      noise(ctx, t, 0.45, 3000, 0.22)
      break
    case 'sunk':
      noise(ctx, t, 0.9, 700, 0.6)
      tone(ctx, t, 240, 35, 0.9, 'sawtooth', 0.16)
      break
    case 'win':
      for (const [i, f] of [523, 659, 784, 1047].entries()) tone(ctx, t + i * 0.12, f, f, 0.25, 'triangle', 0.22)
      break
    case 'lose':
      for (const [i, f] of [392, 330, 262].entries()) tone(ctx, t + i * 0.2, f, f * 0.96, 0.32, 'triangle', 0.22)
      break
  }
}

function tone(ctx: AudioContext, at: number, from: number, to: number, seconds: number, type: OscillatorType, volume: number) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(from, at)
  osc.frequency.exponentialRampToValueAtTime(to, at + seconds)
  gain.gain.setValueAtTime(volume, at)
  gain.gain.exponentialRampToValueAtTime(0.001, at + seconds)
  osc.connect(gain).connect(ctx.destination)
  osc.start(at)
  osc.stop(at + seconds)
}

// A burst of white noise through a closing low-pass filter: splash or boom.
function noise(ctx: AudioContext, at: number, seconds: number, cutoff: number, volume: number) {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const source = ctx.createBufferSource()
  source.buffer = buffer
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(cutoff, at)
  filter.frequency.exponentialRampToValueAtTime(cutoff / 8, at + seconds)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(volume, at)
  gain.gain.exponentialRampToValueAtTime(0.001, at + seconds)
  source.connect(filter).connect(gain).connect(ctx.destination)
  source.start(at)
}
