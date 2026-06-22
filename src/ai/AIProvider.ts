import type { FlowGraph } from '../types/flow'

export interface AIProvider {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly isConfigured: boolean
  generateFlow(prompt: string): Promise<FlowGraph>
  improveFlow(prompt: string, flow: FlowGraph): Promise<FlowGraph>
  explainFlow(flow: FlowGraph): Promise<string>
}

export type AIProviderSummary = Pick<AIProvider, 'id' | 'name' | 'description' | 'isConfigured'>
