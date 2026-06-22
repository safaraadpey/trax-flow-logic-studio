import { Bot, CheckCircle2, LockKeyhole, Settings2 } from 'lucide-react'
import { aiProviderRegistry } from '../../ai/providerRegistry'
import { useAISettingsStore } from '../../store/aiSettingsStore'

export function AISettingsDialog({ onClose }: { onClose: () => void }) {
  const { activeProviderId, setActiveProvider } = useAISettingsStore()
  const providers = aiProviderRegistry.list()

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal ai-settings-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-title">
          <div><strong>AI Settings</strong><span>Select the provider used by every AI request in the editor.</span></div>
          <button className="icon-button" onClick={onClose}>×</button>
        </div>
        <div className="provider-list">
          {providers.map((provider) => {
            const selected = activeProviderId === provider.id
            return (
              <button
                className={`provider-card ${selected ? 'selected' : ''}`}
                key={provider.id}
                onClick={() => setActiveProvider(provider.id)}
              >
                <span className="provider-icon">{provider.id === 'mock' ? <Bot size={17} /> : <Settings2 size={17} />}</span>
                <span className="provider-copy">
                  <strong>{provider.name}</strong>
                  <small>{provider.description}</small>
                </span>
                <span className={`provider-status ${provider.isConfigured ? 'ready' : ''}`}>
                  {provider.isConfigured ? <CheckCircle2 size={13} /> : <LockKeyhole size={13} />}
                  {provider.isConfigured ? 'Ready' : 'Not configured'}
                </span>
              </button>
            )
          })}
        </div>
        <div className="settings-note">
          Provider adapters are registered independently. The canvas and AI Copilot only communicate with the shared AI service.
        </div>
      </div>
    </div>
  )
}
