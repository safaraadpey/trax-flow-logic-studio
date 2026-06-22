import { useMemo, useState } from 'react'
import { Bot, Braces, CheckCircle2, ChevronLeft, ChevronRight, FileCode2, Lightbulb, Sparkles, WandSparkles, XCircle } from 'lucide-react'
import type { FlowGraph } from '../../types/flow'
import { exportMermaid } from '../../lib/exportMermaid'
import { validateFlow } from '../../lib/validateFlow'
import { useFlowStore } from '../../store/flowStore'
import { useAISettingsStore } from '../../store/aiSettingsStore'
import { aiProviderRegistry } from '../../ai/providerRegistry'
import { aiService } from '../../ai/aiService'

const SAMPLE_PROMPT = 'Create a scheduler flow for a bingo app that checks play window, generates random room cap, counts waiting rooms, and creates rooms if needed.'

type PreviewKind = 'json' | 'explanation' | 'mermaid'

export function AICopilotPanel() {
  const { graph, setGraph } = useFlowStore()
  const activeProviderId = useAISettingsStore((state) => state.activeProviderId)
  const activeProvider = aiProviderRegistry.get(activeProviderId)
  const [collapsed, setCollapsed] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [previewFlow, setPreviewFlow] = useState<FlowGraph | null>(null)
  const [previewKind, setPreviewKind] = useState<PreviewKind>('json')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const issues = useMemo(() => previewFlow ? validateFlow(previewFlow) : [], [previewFlow])
  const hasErrors = issues.some((issue) => issue.level === 'error')

  const runRequest = async (request: () => Promise<FlowGraph>) => {
    setLoading(true)
    setError('')
    try {
      const generated = await request()
      setPreviewFlow(generated)
      setPreviewKind('json')
      setMessage('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setLoading(false)
    }
  }

  const generate = (improve = false) => {
    void runRequest(() => improve
      ? aiService.improveFlow(prompt, graph, { providerId: activeProviderId })
      : aiService.generateFlow(prompt, { providerId: activeProviderId }))
  }

  const explain = async () => {
    setLoading(true)
    setError('')
    try {
      const explanation = await aiService.explainFlow(graph, { providerId: activeProviderId })
      setPreviewFlow(null)
      setPreviewKind('explanation')
      setMessage(explanation)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setLoading(false)
    }
  }

  const generateMermaid = () => {
    setPreviewKind('mermaid')
    setMessage(exportMermaid(previewFlow || graph))
  }

  const apply = () => {
    if (!previewFlow || hasErrors) return
    setGraph(previewFlow)
    setMessage('Generated Semantic FlowGraph applied to the canvas.')
  }

  if (collapsed) {
    return (
      <aside className="ai-copilot collapsed">
        <button className="ai-expand" onClick={() => setCollapsed(false)} title="Open AI Copilot"><Bot size={17} /><ChevronLeft size={13} /></button>
        <span>AI COPILOT</span>
      </aside>
    )
  }

  return (
    <aside className="ai-copilot">
      <div className="panel-title ai-title">
        <span><Bot size={14} />AI COPILOT</span>
        <button className="icon-button" onClick={() => setCollapsed(true)} title="Collapse AI Copilot"><ChevronRight size={14} /></button>
      </div>
      <div className="ai-content">
        <div className="local-badge">
          <Sparkles size={12} />
          <span>{activeProvider.name}</span>
          <small>{activeProvider.isConfigured ? 'Active and ready' : 'Registered · configuration required'}</small>
        </div>
        <label>Describe your flow...
          <textarea rows={5} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Describe triggers, decisions, actions, data queries, and outcomes..." />
        </label>
        <button className="sample-prompt" onClick={() => setPrompt(SAMPLE_PROMPT)}><Lightbulb size={13} />Use bingo scheduler sample</button>
        <div className="ai-actions">
          <button disabled={loading} className="primary" onClick={() => generate(false)}><WandSparkles size={14} />{loading ? 'Working…' : 'Generate Flow'}</button>
          <button disabled={loading} onClick={() => generate(true)}><Sparkles size={14} />Improve Current Flow</button>
          <button disabled={loading} onClick={() => void explain()}><Braces size={14} />Explain Current Flow</button>
          <button disabled={loading} onClick={generateMermaid}><FileCode2 size={14} />Generate Mermaid</button>
        </div>
        {error && <div className="ai-request-error">{error}</div>}

        <div className="ai-preview-header">
          <span>{previewKind === 'json' ? 'GENERATED JSON PREVIEW' : previewKind === 'mermaid' ? 'MERMAID PREVIEW' : 'FLOW EXPLANATION'}</span>
          {previewFlow && (
            <span className={hasErrors ? 'preview-invalid' : 'preview-valid'}>
              {hasErrors ? <XCircle size={11} /> : <CheckCircle2 size={11} />}
              {issues.length ? `${issues.length} issue${issues.length === 1 ? '' : 's'}` : 'Valid'}
            </span>
          )}
        </div>
        <pre className="ai-preview">
          {previewKind === 'json'
            ? previewFlow ? JSON.stringify(previewFlow, null, 2) : 'Generate or improve a flow to preview its Semantic FlowGraph JSON.'
            : message || 'No preview generated yet.'}
        </pre>
        {previewFlow && issues.length > 0 && (
          <div className="ai-validation">
            {issues.map((issue, index) => <div className={issue.level} key={`${issue.message}-${index}`}>{issue.message}</div>)}
          </div>
        )}
        <button className="apply-button" disabled={!previewFlow || hasErrors} onClick={apply}>
          <CheckCircle2 size={14} />Apply to Canvas
        </button>
        {message && previewKind === 'json' && <div className="apply-message">{message}</div>}
      </div>
    </aside>
  )
}
