import { afterEach, expect, it, vi } from 'vitest'
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })
it('updates each audio channel independently and keeps music volume across scenes', async () => {
  const gains: { gain: { value: number; setTargetAtTime: ReturnType<typeof vi.fn> }; connect: ReturnType<typeof vi.fn> }[] = []
  const events = new Map<string, () => void>()
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() })
  vi.stubGlobal('window', { addEventListener: (name: string, fn: () => void) => events.set(name, fn), removeEventListener: vi.fn() })
  vi.stubGlobal('fetch', () => Promise.reject(Error('no clip in test')))
  vi.stubGlobal('AudioContext', class {
    currentTime = 0
    destination = {}
    resume() { return Promise.resolve() }
    createGain() {
      const gain = { gain: { value: 0, setTargetAtTime: vi.fn() }, connect: vi.fn() }
      gains.push(gain)
      return gain
    }
  })
  const audio = await import('./sound')
  const { updateSettings } = await import('./settings')
  updateSettings({ musicVolume: 50, effectsVolume: 100 })
  events.get('pointerdown')!()
  expect(gains[1].gain.value).toBeCloseTo(0.315)
  expect(gains[2].gain.value).toBeCloseTo(1.36)
  updateSettings({ musicVolume: 0 })
  expect(gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 0, 0.05)
  expect(gains[2].gain.setTargetAtTime).toHaveBeenLastCalledWith(1.36, 0, 0.05)
  updateSettings({ musicVolume: 50, effectsVolume: 0 })
  audio.setScene('match')
  expect(gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(0.07, 0, 0.4)
  expect(gains[2].gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 0, 0.05)
})
it('defaults to 50% sliders at the same loudness as before', async () => {
  const gains: { gain: { value: number } }[] = []
  const events = new Map<string, () => void>()
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() })
  vi.stubGlobal('window', { addEventListener: (name: string, fn: () => void) => events.set(name, fn), removeEventListener: vi.fn() })
  vi.stubGlobal('fetch', () => Promise.reject(Error('no clip in test')))
  vi.stubGlobal('AudioContext', class {
    currentTime = 0
    destination = {}
    resume() { return Promise.resolve() }
    createGain() {
      const gain = { gain: { value: 0, setTargetAtTime: vi.fn() }, connect: vi.fn() }
      gains.push(gain)
      return gain
    }
  })
  await import('./sound')
  const { getSettings } = await import('./settings')
  expect(getSettings()).toMatchObject({ musicVolume: 50, effectsVolume: 50 })
  events.get('pointerdown')!()
  expect(gains[1].gain.value).toBeCloseTo(0.315)
  expect(gains[2].gain.value).toBeCloseTo(0.68)
})
