import { create } from 'zustand'

interface AppState {
  backendReady: boolean
  setBackendReady: (ready: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  backendReady: false,
  setBackendReady: (ready) => set({ backendReady: ready }),
}))
