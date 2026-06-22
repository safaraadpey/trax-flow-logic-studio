import type { AIProvider } from '../AIProvider'
import type { FlowGraph } from '../../types/flow'

export abstract class UnavailableProvider implements AIProvider {
  abstract readonly id: string
  abstract readonly name: string
  abstract readonly description: string
  readonly isConfigured = false

  protected unavailable(): never {
    throw new Error(`${this.name} is registered but not configured in v0.2. Select Mock Provider in AI Settings.`)
  }

  async generateFlow(_prompt: string): Promise<FlowGraph> {
    void _prompt
    return this.unavailable()
  }

  async improveFlow(_prompt: string, _flow: FlowGraph): Promise<FlowGraph> {
    void _prompt
    void _flow
    return this.unavailable()
  }

  async explainFlow(_flow: FlowGraph): Promise<string> {
    void _flow
    return this.unavailable()
  }
}
