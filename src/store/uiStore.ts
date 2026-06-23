import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type InspectorMode = 'docked' | 'floating'

interface FloatingPosition {
  x: number
  y: number
}

interface UIState {
  inspectorMode: InspectorMode
  inspectorOpen: boolean
  inspectorPosition: FloatingPosition
  setInspectorMode: (mode: InspectorMode) => void
  toggleInspectorMode: () => void
  openInspector: () => void
  closeInspector: () => void
  setInspectorPosition: (position: FloatingPosition) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      inspectorMode: 'docked',
      inspectorOpen: true,
      inspectorPosition: {
        x: typeof window === 'undefined' ? 520 : Math.max(240, Math.round(window.innerWidth / 2 - 160)),
        y: 120,
      },
      setInspectorMode: (mode) => set({ inspectorMode: mode, inspectorOpen: true }),
      toggleInspectorMode: () => set((state) => ({
        inspectorMode: state.inspectorMode === 'docked' ? 'floating' : 'docked',
        inspectorOpen: true,
      })),
      openInspector: () => set({ inspectorOpen: true }),
      closeInspector: () => set({ inspectorOpen: false }),
      setInspectorPosition: (inspectorPosition) => set({ inspectorPosition }),
    }),
    {
      name: 'flow-logic-ui-v03',
      partialize: (state) => ({
        inspectorMode: state.inspectorMode,
        inspectorOpen: state.inspectorOpen,
        inspectorPosition: state.inspectorPosition,
      }),
    },
  ),
)
