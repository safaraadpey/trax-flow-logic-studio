import type { AIProvider } from '../AIProvider'
import type { FlowGraph } from '../../types/flow'
import { validateFlow } from '../../lib/validateFlow'
import { normalizeFlowGraph } from '../../lib/flowVariables'

const API_URL = '/api/gemini'
const DEFAULT_MODEL = 'gemini-3.5-flash'

interface GeminiInteractionResponse {
  output_text?: string
  error?: { message?: string }
  steps?: Array<{ content?: Array<{ text?: string }> }>
}

const FLOW_CONTRACT = `
Return only valid JSON for a FlowGraph. Do not use markdown fences.
FlowGraph fields: id, name, description, nodes, edges, variables, inputs, outputs, createdAt, updatedAt.
Every variable must have: id, unique valid JavaScript identifier name, type, defaultValue, description, and scope.
Variable scope must be one of: global, nodeOutput, input, computed.
All node variable references must reuse entries in variables; never create duplicate variable names.
TimerNode supports variable and expression timing. For duration use durationSource constant|variable|expression with durationValue, durationVariable, or durationExpression plus unit seconds|minutes|hours. For wait_until use waitUntilSource fixed_datetime|variable|expression with untilDatetime, untilVariable, or untilExpression.
Timer duration variables must be number variables. Wait-until variables must be datetime variables.
Every node must have: id, type:"semantic", position:{x:number,y:number}, data.
Node data must have: type, label, description, inputs:[], outputs:[], config:{}, logic:{}, ui:{}.
Allowed semantic node data.type values: StartNode, EndNode, ActionNode, ConditionNode, RandomNode, TimerNode, DbQueryNode, AssignVariableNode, LogNode.
Every edge must have: id, source, target, data:{label:string,condition:string}. Condition edges must use sourceHandle "true" and "false".
The graph must contain exactly one StartNode, at least one EndNode, no disconnected nodes, and true/false outgoing edges for every ConditionNode.
Use readable left-to-right positions, meaningful descriptions, type-specific configs, variables, labeled edges, ISO timestamps, and unique ids.
`

function extractText(response: GeminiInteractionResponse): string {
  if (response.output_text) return response.output_text
  const text = response.steps
    ?.flatMap((step) => step.content || [])
    .map((content) => content.text || '')
    .filter(Boolean)
    .join('\n')
  if (text) return text
  throw new Error(response.error?.message || 'Gemini returned no text output.')
}

function parseFlow(text: string): FlowGraph {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  let flow: FlowGraph
  try {
    flow = JSON.parse(cleaned) as FlowGraph
  } catch {
    throw new Error('Gemini returned invalid FlowGraph JSON.')
  }
  flow = normalizeFlowGraph(flow)
  const issues = validateFlow(flow)
  const errors = issues.filter((issue) => issue.level === 'error')
  if (errors.length) throw new Error(`Gemini generated an invalid flow: ${errors.map((issue) => issue.message).join(' ')}`)
  return flow
}

export class GeminiProvider implements AIProvider {
  readonly id = 'gemini'
  readonly name = 'Gemini'
  readonly description = 'Google Gemini API provider for semantic flow generation and explanation.'
  readonly isConfigured = import.meta.env.VITE_GEMINI_ENABLED === 'true'

  private async request(input: string, systemInstruction: string): Promise<string> {
    if (!this.isConfigured) throw new Error('Gemini is disabled. Add GEMINI_API_KEY and VITE_GEMINI_ENABLED=true to .env.local.')

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: import.meta.env.VITE_GEMINI_MODEL || DEFAULT_MODEL,
        input,
        system_instruction: systemInstruction,
        store: false,
        generation_config: { temperature: 0.2 },
      }),
    })

    const payload = await response.json() as GeminiInteractionResponse
    if (!response.ok) throw new Error(payload.error?.message || `Gemini request failed with status ${response.status}.`)
    return extractText(payload)
  }

  async generateFlow(prompt: string): Promise<FlowGraph> {
    const text = await this.request(
      `Create a complete semantic workflow from this request:\n\n${prompt}`,
      `You are the Flow Logic Studio graph architect. ${FLOW_CONTRACT}`,
    )
    return parseFlow(text)
  }

  async improveFlow(prompt: string, flow: FlowGraph): Promise<FlowGraph> {
    const text = await this.request(
      `Improve the current FlowGraph according to the request. Preserve useful behavior and return the complete revised graph.\n\nRequest:\n${prompt}\n\nCurrent FlowGraph:\n${JSON.stringify(flow)}`,
      `You are the Flow Logic Studio graph architect. ${FLOW_CONTRACT}`,
    )
    return parseFlow(text)
  }

  explainFlow(flow: FlowGraph): Promise<string> {
    return this.request(
      `Explain this semantic workflow in concise plain English. Cover its trigger, decisions, important variables, actions, and possible outcomes.\n\n${JSON.stringify(flow)}`,
      'You explain software workflows clearly for developers. Return plain text, not JSON or markdown code fences.',
    )
  }
}
