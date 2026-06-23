import type { FlowGraph, FlowVariable, VariableScope, VariableType } from '../types/flow'
import { id } from './id'

export const variableTypes: VariableType[] = ['string', 'number', 'boolean', 'datetime', 'object', 'array']
export const variableScopes: VariableScope[] = ['global', 'nodeOutput', 'input', 'computed']

export function createFlowVariable(patch: Partial<FlowVariable> = {}): FlowVariable {
  return {
    id: patch.id || id('var'),
    name: patch.name || '',
    type: patch.type || 'string',
    defaultValue: patch.defaultValue ?? '',
    description: patch.description || '',
    scope: patch.scope || 'global',
  }
}

export function normalizeFlowGraph(graph: FlowGraph): FlowGraph {
  return {
    ...graph,
    nodes: (graph.nodes || []).map((node) => {
      if (node.data.type !== 'TimerNode') return node
      const config = node.data.config
      return {
        ...node,
        data: {
          ...node.data,
          config: {
            mode: config.mode || 'wait_for_duration',
            durationSource: config.durationSource || 'constant',
            durationValue: config.durationValue ?? 1,
            durationVariable: config.durationVariable || '',
            durationExpression: config.durationExpression || '',
            unit: config.unit || config.durationUnit || 'minutes',
            waitUntilSource: config.waitUntilSource || 'fixed_datetime',
            untilDatetime: config.untilDatetime || '',
            untilVariable: config.untilVariable || '',
            untilExpression: config.untilExpression || '',
          },
        },
      }
    }),
    variables: (graph.variables || []).map((variable) => createFlowVariable(variable)),
  }
}

const expressionGlobals = new Set([
  'Math', 'Date', 'Number', 'String', 'Boolean', 'Array', 'Object',
  'true', 'false', 'null', 'undefined', 'NaN', 'Infinity',
])

export function expressionVariableReferences(expression: string): string[] {
  const references = new Set<string>()
  const matcher = /[A-Za-z_$][A-Za-z0-9_$]*/g
  for (const match of expression.matchAll(matcher)) {
    const name = match[0]
    const index = match.index || 0
    if (expressionGlobals.has(name) || expression[index - 1] === '.') continue
    references.add(name)
  }
  return [...references]
}

export function qualifyVariableExpression(expression: string, variableNames: Set<string>): string {
  return expression.replace(/[A-Za-z_$][A-Za-z0-9_$]*/g, (name, offset) => {
    if (!variableNames.has(name) || expression[offset - 1] === '.') return name
    return `context.${name}`
  })
}

export function parseVariableDefault(value: string, type: VariableType): unknown {
  if (value === '') return ''
  if (type === 'number') return Number(value)
  if (type === 'boolean') return value === 'true'
  if (type === 'object' || type === 'array') {
    try { return JSON.parse(value) } catch { return value }
  }
  return value
}

export function formatVariableDefault(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
