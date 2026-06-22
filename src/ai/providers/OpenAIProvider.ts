import { UnavailableProvider } from './UnavailableProvider'

export class OpenAIProvider extends UnavailableProvider {
  readonly id = 'openai'
  readonly name = 'OpenAI'
  readonly description = 'OpenAI-backed flow generation adapter (configuration reserved for a future release).'
}
