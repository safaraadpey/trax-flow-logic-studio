import type { FlowGraph, FlowNode } from '../types/flow'
import { qualifyVariableExpression } from './flowVariables'

function lineFor(node: FlowNode, variableNames: Set<string>) {
  const c = node.data.config
  switch (node.data.type) {
    case 'StartNode': return `// Start: ${node.data.label} (${c.triggerType})`
    case 'EndNode': return `return { status: "${c.resultStatus}" }`
    case 'ActionNode': return `await actions.${c.actionName || 'run'}(context)`
    case 'RandomNode':
      return c.mode === 'coin_flip'
        ? `context.${c.outputVariable || 'result'} = Math.random() >= 0.5`
        : `context.${c.outputVariable || 'result'} = randomBetween(${c.min ?? 0}, ${c.max ?? 10})`
    case 'TimerNode': {
      if (c.mode === 'wait_until') {
        const source = String(c.waitUntilSource || 'fixed_datetime')
        if (source === 'variable') return `await waitUntil(context.${c.untilVariable})`
        if (source === 'expression') return `await waitUntil(${qualifyVariableExpression(String(c.untilExpression || ''), variableNames)})`
        return `await waitUntil(new Date("${c.untilDatetime || ''}"))`
      }
      const source = String(c.durationSource || 'constant')
      const unit = ({ seconds: 'SECOND', minutes: 'MINUTE', hours: 'HOUR' } as Record<string, string>)[String(c.unit || 'minutes')] || 'MINUTE'
      if (source === 'variable') return `await wait(context.${c.durationVariable} * ${unit})`
      if (source === 'expression') return `await wait((${qualifyVariableExpression(String(c.durationExpression || ''), variableNames)}) * ${unit})`
      return `await wait(${c.durationValue ?? 1} * ${unit})`
    }
    case 'DbQueryNode': return `context.${c.outputVariable || 'rows'} = await db.${c.operation}("${c.table}") // modeled query`
    case 'AssignVariableNode': return `context.${c.variableName || 'value'} = ${c.valueExpression || 'undefined'}`
    case 'LogNode': return `logger.${c.level}(${JSON.stringify(c.message || node.data.label)})`
    case 'ConditionNode': return `if (${c.left || 'value'} ${operator(c.operator)} ${c.right || 'expected'}) { /* true branch */ } else { /* false branch */ }`
  }
}

const operator = (value: unknown) => ({
  equals: '===', not_equals: '!==', greater_than: '>', less_than: '<',
  greater_or_equal: '>=', less_or_equal: '<=', contains: '/* contains */',
}[String(value)] || `/* ${value} */`)

export function exportTypescript(graph: FlowGraph) {
  const ordered: FlowNode[] = []
  const visited = new Set<string>()
  const start = graph.nodes.find((node) => node.data.type === 'StartNode') || graph.nodes[0]
  const visit = (node?: FlowNode) => {
    if (!node || visited.has(node.id)) return
    visited.add(node.id)
    ordered.push(node)
    graph.edges.filter((edge) => edge.source === node.id).forEach((edge) => visit(graph.nodes.find((n) => n.id === edge.target)))
  }
  visit(start)
  graph.nodes.forEach(visit)
  const variableNames = new Set(graph.variables.map((variable) => variable.name))
  const typeFor = (type: string) => ({
    string: 'string',
    number: 'number',
    boolean: 'boolean',
    datetime: 'Date',
    object: 'Record<string, unknown>',
    array: 'unknown[]',
  }[type] || 'unknown')

  return [
    `// Generated from Flow Logic Studio: ${graph.name}`,
    'type FlowContext = {',
    ...graph.variables.map((variable) => `  ${variable.name}: ${typeFor(variable.type)}`),
    '}',
    '',
    'async function runFlow(context: FlowContext) {',
    ...ordered.map((node) => `  ${lineFor(node, variableNames)}`),
    '}',
  ].join('\n')
}
