import { UnavailableProvider } from './UnavailableProvider'

export class ClaudeProvider extends UnavailableProvider {
  readonly id = 'claude'
  readonly name = 'Claude'
  readonly description = 'Anthropic Claude adapter (configuration reserved for a future release).'
}
