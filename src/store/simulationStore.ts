import { create } from 'zustand'
import type { FlowGraph } from '../types/flow'
import {
  createSimulationContext,
  runFullSimulation,
  startSimulation,
  stepSimulation,
} from '../lib/simulator/simulator'
import { createIdleSimulationState, type SimulationState } from '../lib/simulator/simulationTypes'

interface SimulationStore {
  graphId: string | null
  inputs: Record<string, unknown>
  state: SimulationState
  prepare: (graph: FlowGraph) => void
  setInput: (name: string, value: unknown) => void
  start: (graph: FlowGraph) => void
  next: (graph: FlowGraph) => void
  runFull: (graph: FlowGraph) => void
  reset: (graph: FlowGraph) => void
}

export const useSimulationStore = create<SimulationStore>((set, get) => ({
  graphId: null,
  inputs: {},
  state: createIdleSimulationState(),
  prepare: (graph) => {
    if (get().graphId === graph.id) return
    const inputs = createSimulationContext(graph)
    set({ graphId: graph.id, inputs, state: createIdleSimulationState(inputs) })
  },
  setInput: (name, value) => set((current) => ({
    inputs: { ...current.inputs, [name]: value },
    state: current.state.status === 'idle'
      ? { ...current.state, context: { ...current.inputs, [name]: value } }
      : current.state,
  })),
  start: (graph) => set((current) => ({
    graphId: graph.id,
    state: startSimulation(graph, current.inputs),
  })),
  next: (graph) => set((current) => ({
    state: stepSimulation(graph, current.state),
  })),
  runFull: (graph) => set((current) => ({
    graphId: graph.id,
    state: runFullSimulation(graph, current.inputs),
  })),
  reset: (graph) => {
    const inputs = createSimulationContext(graph)
    set({ graphId: graph.id, inputs, state: createIdleSimulationState(inputs) })
  },
}))
