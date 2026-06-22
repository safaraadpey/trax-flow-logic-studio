import type { FlowGraph } from '../types/flow'

export type ValidationIssue = {
  level: 'error' | 'warning'
  message: string
  nodeId?: string
}

export function validateFlow(graph: FlowGraph): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const starts = graph.nodes.filter((node) => node.data.type === 'StartNode')
  const ends = graph.nodes.filter((node) => node.data.type === 'EndNode')

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
    }
    if (node.data.type === 'RandomNode' && !String(node.data.config.outputVariable || '').trim()) {
      issues.push({ level: 'error', nodeId: node.id, message: `"${node.data.label}" must define outputVariable.` })
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
