import type { FlowGraph, FlowNode } from '../types/flow'

const safe = (value: string) => value.replace(/"/g, "'").replace(/\n/g, ' ')
const alias = (id: string) => id.replace(/[^a-zA-Z0-9_]/g, '_')

function shape(node: FlowNode) {
  const name = alias(node.id)
  const label = safe(node.data.label)
  if (node.data.type === 'ConditionNode') return `${name}{"${label}"}`
  if (node.data.type === 'StartNode' || node.data.type === 'EndNode') return `${name}(["${label}"])`
  return `${name}["${label}"]`
}

export function exportMermaid(graph: FlowGraph) {
  const lines = ['flowchart TD']
  graph.nodes.forEach((node) => lines.push(`  ${shape(node)}`))
  graph.edges.forEach((edge) => {
    const label = safe(edge.data?.label || edge.data?.condition || '')
    lines.push(`  ${alias(edge.source)} -->${label ? `|${label}|` : ''} ${alias(edge.target)}`)
  })
  return lines.join('\n')
}
