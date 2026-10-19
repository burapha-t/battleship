// Background music and sound effects, played from the clips in
// assets/sounds through the Web Audio API. Device volumes come from #43.
import { getSettings, subscribeSettings, updateSettings } from './settings'
import hitUrl from './assets/sounds/hit.mp3'
import loseUrl from './assets/sounds/lose.mp3'
import missUrl from './assets/sounds/miss.mp3'
import musicUrl from './assets/sounds/music.mp3'
import sunkUrl from './assets/sounds/sunk.mp3'
import winUrl from './assets/sounds/win.mp3'

export type Sound = 'hit' | 'miss' | 'sunk' | 'win' | 'lose'

/** Where the player is: the music is quieter once a match has begun. */
export type Scene = 'menu' | 'match' | 'result'

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
  master.gain.value = 1
  master.connect(ctx.destination)
  const music = ctx.createGain()
  music.gain.value = MUSIC_VOLUME[scene] * getSettings().musicVolume / 100
  music.connect(master)
  const effects = ctx.createGain()
  effects.gain.value = EFFECTS_VOLUME * getSettings().effectsVolume / 100
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

// Keep channels independent; scene changes retain the player's music level.
subscribeSettings(() => {
  if (!engine) return
  engine.music.gain.setTargetAtTime(MUSIC_VOLUME[scene] * getSettings().musicVolume / 100, engine.ctx.currentTime, 0.05)
  engine.effects.gain.setTargetAtTime(EFFECTS_VOLUME * getSettings().effectsVolume / 100, engine.ctx.currentTime, 0.05)
})

export function isMuted(): boolean {
  return getSettings().musicVolume === 0 && getSettings().effectsVolume === 0
}
export function setMuted(value: boolean): void {
  updateSettings({ musicVolume: value ? 0 : 70, effectsVolume: value ? 0 : 85 })
}

/** Fades the music to the scene's level; leaving the result screen stops its clip. */
export function setScene(next: Scene): void {
  if (scene === 'result' && next !== 'result') {
    ending?.stop()
    ending = null
  }
  scene = next
  engine?.music.gain.setTargetAtTime(MUSIC_VOLUME[next] * getSettings().musicVolume / 100, engine.ctx.currentTime, 0.4)
}

export function playSound(sound: Sound): void {
  const buffer = buffers.get(sound)
  if (getSettings().effectsVolume === 0 || !engine || !buffer) return
  const source = engine.ctx.createBufferSource()
  source.buffer = buffer
  source.connect(engine.effects)
  source.start()
  if (sound === 'win' || sound === 'lose') {
    ending?.stop()
    ending = source
  }
}
