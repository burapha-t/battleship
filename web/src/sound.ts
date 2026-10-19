// Background music and sound effects, played from the clips in
// assets/sounds through the Web Audio API. Mute is remembered in localStorage.
import hitUrl from './assets/sounds/hit.mp3'
import loseUrl from './assets/sounds/lose.mp3'
import missUrl from './assets/sounds/miss.mp3'
import musicUrl from './assets/sounds/music.mp3'
import sunkUrl from './assets/sounds/sunk.mp3'
import winUrl from './assets/sounds/win.mp3'

export type Sound = 'hit' | 'miss' | 'sunk' | 'win' | 'lose'

/** Where the player is: the music is quieter once a match has begun. */
export type Scene = 'menu' | 'match' | 'result'

const MUTE_KEY = 'battleship.muted'
const CLIPS: Record<Sound | 'music', string> = {
  hit: hitUrl,
  miss: missUrl,
  sunk: sunkUrl,
  win: winUrl,
  lose: loseUrl,
  music: musicUrl,
}
const MUSIC_VOLUME: Record<Scene, number> = { menu: 0.45, match: 0.1, result: 0.08 }
const EFFECTS_VOLUME = 0.8

type Engine = { ctx: AudioContext; master: GainNode; music: GainNode; effects: GainNode }

let muted = readMuted()
let scene: Scene = 'menu'
let engine: Engine | null = null
const buffers = new Map<Sound | 'music', AudioBuffer>()
// The win or lose clip, cut short when the player leaves the result screen.
let ending: AudioBufferSourceNode | null = null

// Browsers block audio until the player interacts with the page, so the
// context is only created, and the clips loaded, on the first click or key press.
if (typeof window !== 'undefined') {
  const unlock = () => {
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
    engine = start()
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
}

function start(): Engine {
  const ctx = new AudioContext()
  void ctx.resume()
  const master = ctx.createGain()
  master.gain.value = muted ? 0 : 1
  master.connect(ctx.destination)
  const music = ctx.createGain()
  music.gain.value = MUSIC_VOLUME[scene]
  music.connect(master)
  const effects = ctx.createGain()
  effects.gain.value = EFFECTS_VOLUME
  effects.connect(master)

  for (const [name, url] of Object.entries(CLIPS) as [Sound | 'music', string][]) {
    fetch(url)
      .then((res) => res.arrayBuffer())
      .then((data) => ctx.decodeAudioData(data))
      .then((buffer) => {
        buffers.set(name, buffer)
        if (name === 'music') {
          const source = ctx.createBufferSource()
          source.buffer = buffer
          source.loop = true
          source.connect(music)
          source.start()
        }
      })
      .catch(() => {
        // Without this clip the game just plays quieter.
      })
  }
  return { ctx, master, music, effects }
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
  engine?.master.gain.setTargetAtTime(value ? 0 : 1, engine.ctx.currentTime, 0.05)
  try {
    localStorage.setItem(MUTE_KEY, value ? '1' : '0')
  } catch {
    // Not remembered, but still applies for this page.
  }
}

/** Fades the music to the scene's level; leaving the result screen stops its clip. */
export function setScene(next: Scene): void {
  if (scene === 'result' && next !== 'result') {
    ending?.stop()
    ending = null
  }
  scene = next
  engine?.music.gain.setTargetAtTime(MUSIC_VOLUME[next], engine.ctx.currentTime, 0.4)
}

export function playSound(sound: Sound): void {
  const buffer = buffers.get(sound)
  if (muted || !engine || !buffer) return
  const source = engine.ctx.createBufferSource()
  source.buffer = buffer
  source.connect(engine.effects)
  source.start()
  if (sound === 'win' || sound === 'lose') {
    ending?.stop()
    ending = source
  }
}
