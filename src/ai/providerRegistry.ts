import type { AIProvider, AIProviderSummary } from './AIProvider'
import { ClaudeProvider } from './providers/ClaudeProvider'
import { GeminiProvider } from './providers/GeminiProvider'
import { MockProvider } from './providers/MockProvider'
import { OpenAIProvider } from './providers/OpenAIProvider'

class AIProviderRegistry {
  private readonly providers = new Map<string, AIProvider>()

  register(provider: AIProvider): void {
    if (this.providers.has(provider.id)) {
      throw new Error(`AI provider "${provider.id}" is already registered.`)
    }
    this.providers.set(provider.id, provider)
  }

  get(id: string): AIProvider {
    const provider = this.providers.get(id)
    if (!provider) throw new Error(`Unknown AI provider: ${id}`)
    return provider
  }

  list(): AIProviderSummary[] {
    return [...this.providers.values()].map(({ id, name, description, isConfigured }) => ({
      id,
      name,
      description,
      isConfigured,
    }))
  }
}

export const aiProviderRegistry = new AIProviderRegistry()

aiProviderRegistry.register(new MockProvider())
aiProviderRegistry.register(new OpenAIProvider())
aiProviderRegistry.register(new ClaudeProvider())
aiProviderRegistry.register(new GeminiProvider())

export function registerAIProvider(provider: AIProvider): void {
  aiProviderRegistry.register(provider)
}
