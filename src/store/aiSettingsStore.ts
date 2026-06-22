import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { aiProviderRegistry } from '../ai/providerRegistry'

interface AISettingsState {
  activeProviderId: string
  setActiveProvider: (providerId: string) => void
}

export const useAISettingsStore = create<AISettingsState>()(
  persist(
    (set) => ({
      activeProviderId: 'mock',
      setActiveProvider: (providerId) => {
        aiProviderRegistry.get(providerId)
        set({ activeProviderId: providerId })
      },
    }),
    { name: 'flow-logic-ai-settings-v02' },
  ),
)
