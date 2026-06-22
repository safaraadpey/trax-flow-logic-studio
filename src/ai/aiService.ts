import type { FlowGraph } from '../types/flow'
import { aiProviderRegistry } from './providerRegistry'

export interface AIRequestContext {
  providerId: string
}

class AIService {
  generateFlow(prompt: string, context: AIRequestContext): Promise<FlowGraph> {
    return aiProviderRegistry.get(context.providerId).generateFlow(prompt)
  }

  improveFlow(prompt: string, flow: FlowGraph, context: AIRequestContext): Promise<FlowGraph> {
    return aiProviderRegistry.get(context.providerId).improveFlow(prompt, flow)
  }

  explainFlow(flow: FlowGraph, context: AIRequestContext): Promise<string> {
    return aiProviderRegistry.get(context.providerId).explainFlow(flow)
  }
}

export const aiService = new AIService()
