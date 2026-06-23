import type { FlowEdge, FlowGraph, FlowNode } from '../../types/flow'
import { validateFlow } from '../validateFlow'
import { evaluateExpression } from './expressionEvaluator'
import { createIdleSimulationState, type SimulationState, type SimulationTraceEntry } from './simulationTypes'

export interface SimulationOptions {
  maxStepLimit?: number
  random?: () => number
}

const uniqueAppend = (values: string[], value: string) => values.includes(value) ? values : [...values, value]

export function createSimulationContext(graph: FlowGraph): Record<string, unknown> {
  return Object.fromEntries(graph.variables.map((variable) => [variable.name, variable.defaultValue]))
}

const traceFor = (
  state: SimulationState,
  node: FlowNode,
  message: string,
  context: Record<string, unknown>,
): SimulationTraceEntry => ({
  step: state.stepCount + 1,
  nodeId: node.id,
  nodeLabel: node.data.label,
  nodeType: node.data.type,
  message,
  contextSnapshot: { ...context },
})

const outgoingEdges = (graph: FlowGraph, nodeId: string) => graph.edges.filter((edge) => edge.source === nodeId)

const conditionExpression = (node: FlowNode) => {
  const left = String(node.data.config.left ?? '')
  const right = String(node.data.config.right ?? '')
  const operators: Record<string, string> = {
    equals: '==',
    not_equals: '!=',
    greater_than: '>',
    less_than: '<',
    greater_or_equal: '>=',
    less_or_equal: '<=',
  }
  const configured = String(node.data.config.operator || 'equals')
  if (!operators[configured]) throw new Error(`Condition operator "${configured}" is not supported by the simulator.`)
  return `${left} ${operators[configured]} ${right}`
}

const selectConditionEdge = (edges: FlowEdge[], result: boolean) => {
  const expected = result ? ['true', 'yes'] : ['false', 'no']
  return edges.find((edge) => expected.includes(String(edge.sourceHandle || edge.data?.condition || edge.data?.label).toLowerCase()))
}

const selectNextEdge = (graph: FlowGraph, node: FlowNode, conditionResult?: boolean) => {
  const edges = outgoingEdges(graph, node.id)
  if (node.data.type === 'ConditionNode') return selectConditionEdge(edges, Boolean(conditionResult))
  return edges[0]
}

const resolveValue = (value: unknown, context: Record<string, unknown>) => {
  if (typeof value === 'number' || typeof value === 'boolean') return value
  return evaluateExpression(String(value), context)
}

const interpolate = (message: string, context: Record<string, unknown>) => message.replace(
  /\$\{([A-Za-z_$][A-Za-z0-9_$]*)\}/g,
  (_, name: string) => {
    if (!Object.prototype.hasOwnProperty.call(context, name)) throw new Error(`Missing variable "${name}".`)
    return String(context[name])
  },
)

function executeNode(
  graph: FlowGraph,
  state: SimulationState,
  node: FlowNode,
  random: () => number,
): { context: Record<string, unknown>; message: string; conditionResult?: boolean; terminalStatus?: 'completed' | 'failed' } {
  const context = { ...state.context }
  const config = node.data.config

  switch (node.data.type) {
    case 'StartNode':
      return { context, message: 'Simulation started.' }
    case 'EndNode': {
      const resultStatus = String(config.resultStatus || 'success')
      return {
        context,
        message: `Flow ended with status: ${resultStatus}.`,
        terminalStatus: resultStatus === 'failed' ? 'failed' : 'completed',
      }
    }
    case 'RandomNode': {
      const outputVariable = String(config.outputVariable || '')
      if (!outputVariable) throw new Error('Random node has no outputVariable.')
      const mode = String(config.mode || 'number_between')
      let value: unknown
      if (mode === 'number_between') {
        const min = Number(resolveValue(config.min ?? 0, context))
        const max = Number(resolveValue(config.max ?? 10, context))
        if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) throw new Error('Random number range is invalid.')
        value = Math.floor(random() * (max - min + 1)) + min
      } else if (mode === 'coin_flip') {
        const heads = random() >= 0.5
        const outputFormat = String(config.coinFlipOutput || config.outputFormat || 'boolean')
        value = outputFormat === 'heads_tails' ? (heads ? 'heads' : 'tails') : heads
      } else if (mode === 'pick_from_list') {
        let values: unknown[]
        if (Array.isArray(config.listValues)) {
          values = config.listValues
        } else {
          const source = String(config.listValues || '')
          try {
            const parsed = JSON.parse(source)
            values = Array.isArray(parsed) ? parsed : []
          } catch {
            values = source.split(',').map((item) => item.trim()).filter(Boolean)
          }
        }
        if (!values.length) throw new Error('Random list is empty.')
        value = values[Math.floor(random() * values.length)]
      } else {
        throw new Error(`Random mode "${mode}" is not supported.`)
      }
      context[outputVariable] = value
      return { context, message: `Random value generated: ${outputVariable} = ${JSON.stringify(value)}.` }
    }
    case 'ConditionNode': {
      const operator = String(config.operator || 'equals')
      if (operator === 'exists' || operator === 'not_exists') {
        const operand = String(config.left || '')
        const value = evaluateExpression(operand, context)
        const exists = value !== undefined && value !== null
        const result = operator === 'exists' ? exists : !exists
        return { context, conditionResult: result, message: `${operand} ${operator} => ${result}.` }
      }
      const expression = conditionExpression(node)
      const result = Boolean(evaluateExpression(expression, context))
      return { context, conditionResult: result, message: `${expression} => ${result}.` }
    }
    case 'AssignVariableNode': {
      const variableName = String(config.variableName || '')
      if (!variableName) throw new Error('Assignment node has no variableName.')
      const expression = String(config.valueExpression || '')
      const value = evaluateExpression(expression, context)
      context[variableName] = value
      return { context, message: `Assigned ${variableName} = ${JSON.stringify(value)}.` }
    }
    case 'TimerNode': {
      if (config.mode === 'wait_until') {
        const source = String(config.waitUntilSource || 'fixed_datetime')
        const value = source === 'variable'
          ? resolveValue(config.untilVariable, context)
          : source === 'expression'
            ? evaluateExpression(String(config.untilExpression || ''), context)
            : config.untilDatetime
        return { context, message: `Timer skipped in simulation: wait until ${String(value)}.` }
      }
      const source = String(config.durationSource || 'constant')
      const value = source === 'variable'
        ? resolveValue(config.durationVariable, context)
        : source === 'expression'
          ? evaluateExpression(String(config.durationExpression || ''), context)
          : config.durationValue
      return { context, message: `Timer skipped in simulation: wait ${String(value)} ${String(config.unit || 'minutes')}.` }
    }
    case 'DbQueryNode': {
      const outputVariable = String(config.outputVariable || '')
      if (!outputVariable) throw new Error('DB query has no outputVariable.')
      if (!Object.prototype.hasOwnProperty.call(context, outputVariable) || context[outputVariable] === undefined || context[outputVariable] === '') {
        throw new Error(`DB Query mock "${outputVariable}" is unresolved. Provide it in Simulation Inputs.`)
      }
      return { context, message: `DB Query mocked: ${outputVariable} = ${JSON.stringify(context[outputVariable])}.` }
    }
    case 'ActionNode': {
      const mapping = config.outputMapping
      if (typeof mapping === 'string' && mapping.trim() && mapping.trim() !== '{}') {
        try {
          const outputs = JSON.parse(mapping) as Record<string, unknown>
          for (const [name, expression] of Object.entries(outputs)) {
            context[name] = typeof expression === 'string' ? evaluateExpression(expression, context) : expression
          }
        } catch (reason) {
          if (reason instanceof SyntaxError) throw new Error('Action outputMapping must be valid JSON.')
          throw reason
        }
      }
      return { context, message: `Action simulated: ${node.data.label}.` }
    }
    case 'LogNode':
      return { context, message: interpolate(String(config.message || node.data.label), context) }
  }
}

export function startSimulation(
  graph: FlowGraph,
  inputContext: Record<string, unknown>,
  options: SimulationOptions = {},
): SimulationState {
  const initial = createIdleSimulationState(inputContext, options.maxStepLimit || 100)
  const validationError = validateFlow(graph).find((issue) => issue.level === 'error')
  if (validationError) {
    return {
      ...initial,
      status: 'failed',
      trace: [{
        step: 0,
        nodeId: validationError.nodeId || '',
        nodeLabel: 'Validation',
        nodeType: 'StartNode',
        message: `Simulation stopped: ${validationError.message}`,
        contextSnapshot: { ...inputContext },
      }],
    }
  }
  const start = graph.nodes.find((node) => node.data.type === 'StartNode')
  if (!start) return { ...initial, status: 'failed' }
  return {
    ...initial,
    status: 'paused',
    currentNodeId: start.id,
    visitedNodeIds: [start.id],
  }
}

export function stepSimulation(
  graph: FlowGraph,
  state: SimulationState,
  options: SimulationOptions = {},
): SimulationState {
  if (!state.currentNodeId || !['paused', 'running'].includes(state.status)) return state
  const node = graph.nodes.find((item) => item.id === state.currentNodeId)
  if (!node) return { ...state, status: 'failed', currentNodeId: undefined }
  if (state.stepCount >= state.maxStepLimit) {
    return {
      ...state,
      status: 'failed',
      currentNodeId: undefined,
      failedNodeIds: uniqueAppend(state.failedNodeIds, node.id),
      trace: [...state.trace, traceFor(state, node, 'Simulation stopped: possible infinite loop.', state.context)],
    }
  }

  try {
    const execution = executeNode(graph, state, node, options.random || Math.random)
    const completedNodeIds = uniqueAppend(state.completedNodeIds, node.id)
    const trace = [...state.trace, traceFor(state, node, execution.message, execution.context)]
    const stepCount = state.stepCount + 1
    if (execution.terminalStatus) {
      return {
        ...state,
        status: execution.terminalStatus,
        currentNodeId: undefined,
        context: execution.context,
        completedNodeIds,
        failedNodeIds: execution.terminalStatus === 'failed' ? uniqueAppend(state.failedNodeIds, node.id) : state.failedNodeIds,
        trace,
        stepCount,
      }
    }

    const edge = selectNextEdge(graph, node, execution.conditionResult)
    if (!edge) throw new Error('No matching outgoing edge was found.')
    const skippedNodeIds = node.data.type === 'ConditionNode'
      ? outgoingEdges(graph, node.id)
        .filter((candidate) => candidate.id !== edge.id)
        .reduce((ids, candidate) => uniqueAppend(ids, candidate.target), state.skippedNodeIds)
      : state.skippedNodeIds
    return {
      ...state,
      status: 'paused',
      currentNodeId: edge.target,
      context: execution.context,
      visitedNodeIds: uniqueAppend(state.visitedNodeIds, edge.target),
      completedNodeIds,
      skippedNodeIds,
      takenEdgeIds: [...state.takenEdgeIds, edge.id],
      trace,
      stepCount,
    }
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : String(reason)
    return {
      ...state,
      status: 'failed',
      currentNodeId: node.id,
      failedNodeIds: uniqueAppend(state.failedNodeIds, node.id),
      trace: [...state.trace, traceFor(state, node, `Simulation failed: ${message}`, state.context)],
      stepCount: state.stepCount + 1,
    }
  }
}

export function runFullSimulation(
  graph: FlowGraph,
  inputContext: Record<string, unknown>,
  options: SimulationOptions = {},
): SimulationState {
  let state = startSimulation(graph, inputContext, options)
  if (state.status === 'failed') return state
  state = { ...state, status: 'running' }
  while (state.status === 'running' || state.status === 'paused') {
    const next = stepSimulation(graph, { ...state, status: 'running' }, options)
    state = next.status === 'paused' ? { ...next, status: 'running' } : next
  }
  return state
}
