import { useSyncExternalStore } from 'react'
import { getSettings, subscribeSettings } from './settings'
export function useSettings() {
  return useSyncExternalStore(subscribeSettings, getSettings)
}
