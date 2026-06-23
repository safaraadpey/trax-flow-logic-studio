import type { FlowGraph } from '../types/flow'
import { expressionVariableReferences } from './flowVariables'

export type ValidationIssue = {
  level: 'error' | 'warning'
  message: string
  nodeId?: string
}

export function validateFlow(graph: FlowGraph): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const starts = graph.nodes.filter((node) => node.data.type === 'StartNode')
  const ends = graph.nodes.filter((node) => node.data.type === 'EndNode')
  const variableNames = new Set(graph.variables.map((variable) => variable.name))
  const seenNames = new Set<string>()
  const identifier = /^[A-Za-z_$][A-Za-z0-9_$]*$/
  const literals = new Set(['true', 'false', 'null', 'undefined'])

  for (const variable of graph.variables) {
    if (seenNames.has(variable.name)) issues.push({ level: 'error', message: `Variable name "${variable.name}" must be unique.` })
    seenNames.add(variable.name)
    if (!identifier.test(variable.name)) issues.push({ level: 'error', message: `Variable name "${variable.name}" is not a valid JavaScript identifier.` })
  }

  if (starts.length !== 1) issues.push({ level: 'error', message: `Flow must have exactly one Start node (found ${starts.length}).` })
  if (ends.length < 1) issues.push({ level: 'error', message: 'Flow must have at least one End node.' })

  for (const node of graph.nodes) {
    const incoming = graph.edges.filter((edge) => edge.target === node.id)
    const outgoing = graph.edges.filter((edge) => edge.source === node.id)
    if (node.data.type === 'ConditionNode') {
      const handles = new Set(outgoing.map((edge) => edge.sourceHandle || edge.data?.condition || edge.data?.label))
      if (!handles.has('true') || !handles.has('false')) {
        issues.push({ level: 'error', nodeId: node.id, message: `"${node.data.label}" needs true and false outgoing edges.` })
      }
      for (const key of ['left', 'right']) {
        const operand = String(node.data.config[key] || '').trim()
        if (identifier.test(operand) && !literals.has(operand) && !variableNames.has(operand)) {
          issues.push({ level: 'warning', nodeId: node.id, message: `"${node.data.label}" references unknown variable "${operand}".` })
        }
      }
    }
    if (node.data.type === 'RandomNode' || node.data.type === 'DbQueryNode') {
      const outputVariable = String(node.data.config.outputVariable || '').trim()
      if (!outputVariable) {
        issues.push({ level: 'error', nodeId: node.id, message: `"${node.data.label}" must define outputVariable.` })
      } else if (!variableNames.has(outputVariable)) {
        issues.push({ level: 'error', nodeId: node.id, message: `"${node.data.label}" outputVariable "${outputVariable}" must exist in flow variables.` })
      }
    }
    if (node.data.type === 'AssignVariableNode') {
      const variableName = String(node.data.config.variableName || '').trim()
      if (!variableName || !variableNames.has(variableName)) {
        issues.push({ level: 'error', nodeId: node.id, message: `"${node.data.label}" variableName "${variableName || '(empty)'}" must exist in flow variables.` })
      }
    }
    if (node.data.type === 'TimerNode') {
      const config = node.data.config
      if (config.mode === 'wait_for_duration') {
        const source = String(config.durationSource || 'constant')
        if (source === 'variable') {
          const name = String(config.durationVariable || '')
          const variable = graph.variables.find((item) => item.name === name)
          if (!variable) issues.push({ level: 'error', nodeId: node.id, message: `"${node.data.label}" duration variable "${name || '(empty)'}" does not exist.` })
          else if (variable.type !== 'number') issues.push({ level: 'error', nodeId: node.id, message: `"${node.data.label}" duration variable "${name}" must be a number.` })
        }
        if (source === 'expression') {
          const expression = String(config.durationExpression || '').trim()
          if (!expression) issues.push({ level: 'error', nodeId: node.id, message: `"${node.data.label}" requires a duration expression.` })
          for (const reference of expressionVariableReferences(expression)) {
            if (!variableNames.has(reference)) issues.push({ level: 'error', nodeId: node.id, message: `"${node.data.label}" duration expression references unknown variable "${reference}".` })
          }
        }
      } else {
        const source = String(config.waitUntilSource || 'fixed_datetime')
        if (source === 'fixed_datetime' && !String(config.untilDatetime || '').trim()) {
          issues.push({ level: 'error', nodeId: node.id, message: `"${node.data.label}" requires a fixed datetime.` })
        }
        if (source === 'variable') {
          const name = String(config.untilVariable || '')
          const variable = graph.variables.find((item) => item.name === name)
          if (!variable) issues.push({ level: 'error', nodeId: node.id, message: `"${node.data.label}" wait-until variable "${name || '(empty)'}" does not exist.` })
          else if (variable.type !== 'datetime') issues.push({ level: 'error', nodeId: node.id, message: `"${node.data.label}" wait-until variable "${name}" must be datetime-compatible.` })
        }
        if (source === 'expression') {
          const expression = String(config.untilExpression || '').trim()
          if (!expression) issues.push({ level: 'error', nodeId: node.id, message: `"${node.data.label}" requires a wait-until expression.` })
          for (const reference of expressionVariableReferences(expression)) {
            if (!variableNames.has(reference)) issues.push({ level: 'error', nodeId: node.id, message: `"${node.data.label}" wait-until expression references unknown variable "${reference}".` })
          }
        }
      }
    }
    if (node.data.type !== 'StartNode' && incoming.length === 0) {
      issues.push({ level: 'warning', nodeId: node.id, message: `"${node.data.label}" has no incoming edge.` })
    }
    if (node.data.type !== 'EndNode' && outgoing.length === 0) {
      issues.push({ level: 'warning', nodeId: node.id, message: `"${node.data.label}" has no outgoing edge.` })
    }
  }
  return issues
}
