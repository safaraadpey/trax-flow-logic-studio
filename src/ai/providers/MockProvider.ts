import type { AIProvider } from '../AIProvider'
import type { FlowGraph } from '../../types/flow'
import { explainMockFlow, generateMockFlow } from '../../lib/aiFlowCopilot'

export class MockProvider implements AIProvider {
  readonly id = 'mock'
  readonly name = 'Mock Provider'
  readonly description = 'Local deterministic generator for development and demos.'
  readonly isConfigured = true

  async generateFlow(prompt: string): Promise<FlowGraph> {
    return generateMockFlow(prompt)
  }

  async improveFlow(prompt: string, flow: FlowGraph): Promise<FlowGraph> {
    return generateMockFlow(prompt, flow)
  }

  async explainFlow(flow: FlowGraph): Promise<string> {
    return explainMockFlow(flow)
  }
}
