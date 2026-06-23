import type { FlowNodeType } from '../../types/flow'

export type SimulationStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed'

export interface SimulationTraceEntry {
  step: number
  nodeId: string
  nodeLabel: string
  nodeType: FlowNodeType
  message: string
  contextSnapshot?: Record<string, unknown>
}

export interface SimulationState {
  status: SimulationStatus
  currentNodeId?: string
  context: Record<string, unknown>
  visitedNodeIds: string[]
  completedNodeIds: string[]
  failedNodeIds: string[]
  skippedNodeIds: string[]
  takenEdgeIds: string[]
  trace: SimulationTraceEntry[]
  stepCount: number
  maxStepLimit: number
}

export const createIdleSimulationState = (
  context: Record<string, unknown> = {},
  maxStepLimit = 100,
): SimulationState => ({
  status: 'idle',
  context: { ...context },
  visitedNodeIds: [],
  completedNodeIds: [],
  failedNodeIds: [],
  skippedNodeIds: [],
  takenEdgeIds: [],
  trace: [],
  stepCount: 0,
  maxStepLimit,
})
