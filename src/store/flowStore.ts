import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { addEdge, applyEdgeChanges, applyNodeChanges, type Connection, type EdgeChange, type NodeChange, type Viewport } from '@xyflow/react'
import type { FlowEdge, FlowGraph, FlowNode, FlowNodeData, FlowNodeType, FlowVariable } from '../types/flow'
import { createFlowNode } from '../types/flow'
import { createCardNumberDemo, createDemoFlow } from '../lib/demoFlow'
import { id } from '../lib/id'
import { createFlowVariable, normalizeFlowGraph } from '../lib/flowVariables'

export type EditorSelection = { kind: 'node' | 'edge'; id: string } | null

interface FlowState {
  graph: FlowGraph
  selection: EditorSelection
  viewport: Viewport
  fitViewVersion: number
  savedAt: string | null
  setGraph: (graph: FlowGraph) => void
  loadProject: (graph: FlowGraph, selection: EditorSelection, viewport: Viewport) => void
  setViewport: (viewport: Viewport) => void
  newFlow: () => void
  loadDemo: () => void
  loadCardDemo: () => void
  addVariable: (patch?: Partial<FlowVariable>) => FlowVariable
  updateVariable: (variableId: string, patch: Partial<FlowVariable>) => void
  removeVariable: (variableId: string) => void
  addNode: (type: FlowNodeType, position: { x: number; y: number }) => void
  onNodesChange: (changes: NodeChange<FlowNode>[]) => void
  onEdgesChange: (changes: EdgeChange<FlowEdge>[]) => void
  onConnect: (connection: Connection) => void
  select: (selection: EditorSelection) => void
  updateNode: (nodeId: string, patch: Partial<FlowNodeData>) => void
  updateNodeConfig: (nodeId: string, key: string, value: unknown) => void
  updateEdge: (edgeId: string, patch: { label?: string; condition?: string }) => void
  removeSelected: () => void
  save: () => void
  autoLayout: () => void
}

const blankGraph = (): FlowGraph => {
  const now = new Date().toISOString()
  return {
    id: id('flow'),
    name: 'Untitled Flow',
    description: '',
    nodes: [],
    edges: [],
    variables: [],
    inputs: [],
    outputs: [],
    createdAt: now,
    updatedAt: now,
  }
}

const touch = (graph: FlowGraph): FlowGraph => ({ ...graph, updatedAt: new Date().toISOString() })

export const useFlowStore = create<FlowState>()(
  persist(
    (set) => ({
      graph: blankGraph(),
      selection: null,
      viewport: { x: 0, y: 0, zoom: 1 },
      fitViewVersion: 0,
      savedAt: null,
      setGraph: (graph) => set((state) => ({
        graph: touch(normalizeFlowGraph(graph)),
        selection: null,
        fitViewVersion: state.fitViewVersion + 1,
      })),
      loadProject: (graph, selection, viewport) => set({
        graph: normalizeFlowGraph(graph),
        selection,
        viewport,
        savedAt: graph.updatedAt || null,
      }),
      setViewport: (viewport) => set({ viewport }),
      newFlow: () => set({ graph: blankGraph(), selection: null, viewport: { x: 0, y: 0, zoom: 1 }, savedAt: null }),
      loadDemo: () => set((state) => ({ graph: createDemoFlow(), selection: null, fitViewVersion: state.fitViewVersion + 1 })),
      loadCardDemo: () => set((state) => ({ graph: createCardNumberDemo(), selection: null, fitViewVersion: state.fitViewVersion + 1 })),
      addVariable: (patch = {}) => {
        const variable = createFlowVariable(patch)
        set((state) => ({ graph: touch({ ...state.graph, variables: [...state.graph.variables, variable] }) }))
        return variable
      },
      updateVariable: (variableId, patch) => set((state) => ({
        graph: touch({
          ...state.graph,
          variables: state.graph.variables.map((variable) => variable.id === variableId ? { ...variable, ...patch } : variable),
        }),
      })),
      removeVariable: (variableId) => set((state) => ({
        graph: touch({ ...state.graph, variables: state.graph.variables.filter((variable) => variable.id !== variableId) }),
      })),
      addNode: (type, position) => set((state) => {
        const node = createFlowNode(type, position, id('node'))
        return { graph: touch({ ...state.graph, nodes: [...state.graph.nodes, node] }), selection: { kind: 'node', id: node.id } }
      }),
      onNodesChange: (changes) => set((state) => ({ graph: touch({ ...state.graph, nodes: applyNodeChanges(changes, state.graph.nodes) }) })),
      onEdgesChange: (changes) => set((state) => ({ graph: touch({ ...state.graph, edges: applyEdgeChanges(changes, state.graph.edges) }) })),
      onConnect: (connection) => set((state) => {
        const edge: FlowEdge = {
          ...connection,
          id: id('edge'),
          data: { label: connection.sourceHandle || '', condition: connection.sourceHandle || '' },
        }
        return { graph: touch({ ...state.graph, edges: addEdge(edge, state.graph.edges) }) }
      }),
      select: (selection) => set({ selection }),
      updateNode: (nodeId, patch) => set((state) => ({
        graph: touch({ ...state.graph, nodes: state.graph.nodes.map((node) => node.id === nodeId ? { ...node, data: { ...node.data, ...patch } } : node) }),
      })),
      updateNodeConfig: (nodeId, key, value) => set((state) => ({
        graph: touch({
          ...state.graph,
          nodes: state.graph.nodes.map((node) => node.id === nodeId
            ? { ...node, data: { ...node.data, config: { ...node.data.config, [key]: value } } }
            : node),
        }),
      })),
      updateEdge: (edgeId, patch) => set((state) => ({
        graph: touch({
          ...state.graph,
          edges: state.graph.edges.map((edge) => edge.id === edgeId
            ? { ...edge, label: patch.label ?? edge.label, data: { ...edge.data!, ...patch } }
            : edge),
        }),
      })),
      removeSelected: () => set((state) => {
        if (!state.selection) return state
        if (state.selection.kind === 'node') {
          const nodeId = state.selection.id
          return { graph: touch({ ...state.graph, nodes: state.graph.nodes.filter((n) => n.id !== nodeId), edges: state.graph.edges.filter((e) => e.source !== nodeId && e.target !== nodeId) }), selection: null }
        }
        return { graph: touch({ ...state.graph, edges: state.graph.edges.filter((e) => e.id !== state.selection!.id) }), selection: null }
      }),
      save: () => set({ savedAt: new Date().toISOString() }),
      autoLayout: () => set((state) => {
        const incoming = new Map(state.graph.nodes.map((node) => [node.id, 0]))
        state.graph.edges.forEach((edge) => incoming.set(edge.target, (incoming.get(edge.target) || 0) + 1))
        const roots = state.graph.nodes.filter((node) => (incoming.get(node.id) || 0) === 0)
        const levels = new Map<string, number>()
        const queue = roots.map((node) => ({ id: node.id, level: 0 }))
        while (queue.length) {
          const current = queue.shift()!
          if ((levels.get(current.id) ?? -1) >= current.level) continue
          levels.set(current.id, current.level)
          state.graph.edges.filter((edge) => edge.source === current.id).forEach((edge) => queue.push({ id: edge.target, level: current.level + 1 }))
        }
        const rows = new Map<number, number>()
        const nodes = state.graph.nodes.map((node) => {
          const level = levels.get(node.id) ?? 0
          const row = rows.get(level) || 0
          rows.set(level, row + 1)
          return { ...node, position: { x: 80 + level * 300, y: 80 + row * 170 } }
        })
        return { graph: touch({ ...state.graph, nodes }) }
      }),
    }),
    {
      name: 'flow-logic-studio-v01',
      partialize: (state) => ({
        graph: state.graph,
        selection: state.selection,
        viewport: state.viewport,
        savedAt: state.savedAt,
      }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<FlowState>
        return {
          ...current,
          ...saved,
          graph: saved.graph ? normalizeFlowGraph(saved.graph) : current.graph,
          viewport: saved.viewport || current.viewport,
          fitViewVersion: current.fitViewVersion,
        }
      },
    },
  ),
)
