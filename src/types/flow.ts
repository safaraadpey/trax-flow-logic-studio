import type { Edge, Node, XYPosition } from '@xyflow/react'

export const nodeTypes = [
  'StartNode',
  'EndNode',
  'ActionNode',
  'ConditionNode',
  'RandomNode',
  'TimerNode',
  'DbQueryNode',
  'AssignVariableNode',
  'LogNode',
] as const

export type FlowNodeType = (typeof nodeTypes)[number]
export type VariableType = 'string' | 'number' | 'boolean' | 'datetime' | 'object' | 'array'

export interface FlowPort {
  name: string
  type: VariableType
  description?: string
}

export interface FlowNodeData extends Record<string, unknown> {
  type: FlowNodeType
  label: string
  description: string
  inputs: FlowPort[]
  outputs: FlowPort[]
  config: Record<string, unknown>
  logic: Record<string, unknown>
  ui: { color?: string; collapsed?: boolean }
}

export type FlowNode = Node<FlowNodeData>

export interface FlowEdgeData extends Record<string, unknown> {
  label: string
  condition: string
}

export type FlowEdge = Edge<FlowEdgeData>

export interface FlowVariable {
  name: string
  type: VariableType
  defaultValue: unknown
  description: string
}

export interface FlowGraph {
  id: string
  name: string
  description: string
  nodes: FlowNode[]
  edges: FlowEdge[]
  variables: FlowVariable[]
  inputs: FlowPort[]
  outputs: FlowPort[]
  createdAt: string
  updatedAt: string
}

export const nodeLabels: Record<FlowNodeType, string> = {
  StartNode: 'Start',
  EndNode: 'End',
  ActionNode: 'Action',
  ConditionNode: 'Condition',
  RandomNode: 'Random',
  TimerNode: 'Timer',
  DbQueryNode: 'DB Query',
  AssignVariableNode: 'Assign Variable',
  LogNode: 'Log',
}

export const defaultConfig = (type: FlowNodeType): Record<string, unknown> => {
  switch (type) {
    case 'StartNode': return { triggerType: 'manual' }
    case 'EndNode': return { resultStatus: 'success' }
    case 'ActionNode': return { actionName: '', inputMapping: '{}', outputMapping: '{}' }
    case 'ConditionNode': return { left: '', operator: 'equals', right: '', trueLabel: 'true', falseLabel: 'false' }
    case 'RandomNode': return { mode: 'number_between', min: 0, max: 10, listValues: '', outputVariable: '' }
    case 'TimerNode': return { mode: 'wait_for_duration', durationValue: 1, durationUnit: 'minutes', untilDatetime: '' }
    case 'DbQueryNode': return { queryName: '', table: '', operation: 'select', filters: '[]', outputVariable: '' }
    case 'AssignVariableNode': return { variableName: '', valueExpression: '' }
    case 'LogNode': return { message: '', level: 'info' }
  }
}

export function createFlowNode(type: FlowNodeType, position: XYPosition, id: string): FlowNode {
  return {
    id,
    type: 'semantic',
    position,
    data: {
      type,
      label: nodeLabels[type],
      description: '',
      inputs: [],
      outputs: [],
      config: defaultConfig(type),
      logic: {},
      ui: {},
    },
  }
}
