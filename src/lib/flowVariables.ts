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
    variables: (graph.variables || []).map((variable) => createFlowVariable(variable)),
  }
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
