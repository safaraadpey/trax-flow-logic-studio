import type { FlowEdge, FlowNode, FlowNodeType } from '../types/flow'
import { createFlowNode } from '../types/flow'
import { id } from './id'

type Parsed = { nodes: FlowNode[]; edges: FlowEdge[] }

function parseRef(raw: string): { ref: string; label: string; type: FlowNodeType } {
  const value = raw.trim()
  const ref = value.match(/^([A-Za-z0-9_]+)/)?.[1]
  if (!ref) throw new Error(`Invalid node reference: ${raw}`)
  if (value.includes('{')) return { ref, label: value.match(/\{+["']?(.*?)["']?\}+/)?.[1] || ref, type: 'ConditionNode' }
  if (value.includes('([') || value.includes('((')) return { ref, label: value.match(/\[?["']?(.*?)["']?\]?\)/)?.[1] || ref, type: 'StartNode' }
  return { ref, label: value.match(/\[["']?(.*?)["']?\]/)?.[1] || ref, type: 'ActionNode' }
}

export function importMermaid(source: string): Parsed {
  const map = new Map<string, FlowNode>()
  const edges: FlowEdge[] = []
  const lines = source.split('\n').map((line) => line.trim()).filter(Boolean)

  for (const line of lines) {
    if (/^(flowchart|graph)\s+/i.test(line) || line.startsWith('%%')) continue
    const parts = line.split(/-->(?:\|([^|]+)\|)?/)
    if (parts.length < 2) continue
    const label = parts.length === 3 ? (parts[1] || '') : ''
    const left = parseRef(parts[0])
    const right = parseRef(parts[parts.length - 1])
    for (const item of [left, right]) {
      const existing = map.get(item.ref)
      if (existing) {
        if (item.label !== item.ref) existing.data.label = item.label
        if (item.type === 'ConditionNode') existing.data.type = item.type
      } else {
        const node = createFlowNode(item.type, { x: map.size % 3 * 260, y: Math.floor(map.size / 3) * 160 }, item.ref)
        node.data.label = item.label
        map.set(item.ref, node)
      }
    }
    edges.push({
      id: id('edge'),
      source: left.ref,
      target: right.ref,
      sourceHandle: label === 'true' || label === 'false' ? label : undefined,
      data: { label, condition: label },
    })
  }
  if (map.size === 0) throw new Error('No supported Mermaid edges were found.')
  const nodes = [...map.values()]
  const incoming = new Set(edges.map((edge) => edge.target))
  const outgoing = new Set(edges.map((edge) => edge.source))
  nodes.forEach((node) => {
    if (!incoming.has(node.id) && node.data.type !== 'ConditionNode') node.data.type = 'StartNode'
    if (!outgoing.has(node.id) && node.data.type !== 'ConditionNode') node.data.type = 'EndNode'
  })
  return { nodes, edges }
}
