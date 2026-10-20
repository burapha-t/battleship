import { afterEach, expect, it, vi } from 'vitest'
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })
function storage(values: Record<string, string> = {}) {
  vi.stubGlobal('localStorage', { getItem: (key: string) => values[key] ?? null, setItem: (key: string, value: string) => { values[key] = value } })
  return values
}
it('persists independent volumes and language across reloads', async () => {
  storage()
  const store = await import('./settings')
  store.updateSettings({ musicVolume: 0, effectsVolume: 45, language: 'th' })
  vi.resetModules()
  expect((await import('./settings')).getSettings()).toEqual({ musicVolume: 0, effectsVolume: 45, language: 'th' })
})
it('honors legacy mute and quoted language', async () => {
  storage({ 'battleship.muted': '1', 'battleship.language': '"th"' })
  expect((await import('./settings')).getSettings()).toEqual({ musicVolume: 0, effectsVolume: 0, language: 'th' })
})
it('bounds invalid values', async () => {
  storage({ 'battleship.music-volume': 'broken', 'battleship.effects-volume': '200' })
  const store = await import('./settings')
  expect(store.getSettings().musicVolume).toBe(50)
  expect(store.getSettings().effectsVolume).toBe(100)
  store.updateSettings({ musicVolume: -1, effectsVolume: NaN })
  expect(store.getSettings().musicVolume).toBe(0)
  expect(store.getSettings().effectsVolume).toBe(100)
})
it('works and notifies when browser storage is blocked', async () => {
  vi.stubGlobal('localStorage', { getItem() { throw Error('blocked') }, setItem() { throw Error('blocked') } })
  const store = await import('./settings')
  const listener = vi.fn()
  const unsubscribe = store.subscribeSettings(listener)
  store.updateSettings({ musicVolume: 15 })
  expect(store.getSettings().musicVolume).toBe(15)
  expect(listener).toHaveBeenCalledTimes(1)
  unsubscribe()
  store.updateSettings({ musicVolume: 20 })
  expect(listener).toHaveBeenCalledTimes(1)
})
