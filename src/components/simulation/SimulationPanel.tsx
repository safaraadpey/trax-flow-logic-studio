import { useEffect } from 'react'
import { FastForward, Play, RotateCcw, StepForward } from 'lucide-react'
import { useFlowStore } from '../../store/flowStore'
import { useSimulationStore } from '../../store/simulationStore'
import type { FlowVariable } from '../../types/flow'

const formatInput = (value: unknown) => {
  if (value === undefined || value === null) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

const parseInput = (variable: FlowVariable, value: string): unknown => {
  if (value === '') return ''
  if (variable.type === 'number') {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? value : parsed
  }
  if (variable.type === 'boolean') return value === 'true'
  if (variable.type === 'object' || variable.type === 'array') {
    try { return JSON.parse(value) } catch { return value }
  }
  return value
}

export function SimulationPanel() {
  const graph = useFlowStore((store) => store.graph)
  const { inputs, state, prepare, setInput, start, next, runFull, reset } = useSimulationStore()

  useEffect(() => prepare(graph), [graph, prepare])

  const currentNode = graph.nodes.find((node) => node.id === state.currentNodeId)
  const canStep = state.status === 'paused' || state.status === 'running'

  return (
    <div className="simulation-panel">
      <section className="simulation-controls">
        <div className="simulation-actions">
          <button onClick={() => start(graph)}><Play size={13} />Start Simulation</button>
          <button disabled={!canStep} onClick={() => next(graph)}><StepForward size={13} />Next Step</button>
          <button className="primary" onClick={() => runFull(graph)}><FastForward size={13} />Run Full Simulation</button>
          <button onClick={() => reset(graph)}><RotateCcw size={13} />Reset</button>
        </div>
        <div className={`simulation-status ${state.status}`}>
          <span>{state.status}</span>
          <strong>{currentNode ? currentNode.data.label : state.status === 'idle' ? 'Not started' : 'No active node'}</strong>
          <small>{state.stepCount} / {state.maxStepLimit} steps</small>
        </div>
      </section>

      <section className="simulation-inputs">
        <div className="simulation-heading"><strong>Simulation Inputs</strong><span>Mock runtime values</span></div>
        <div className="simulation-input-grid">
          {graph.variables.map((variable) => (
            <label key={variable.id}>
              <span>{variable.name}<small>{variable.type}</small></span>
              {variable.type === 'boolean' ? (
                <select value={String(inputs[variable.name] ?? false)} onChange={(event) => setInput(variable.name, event.target.value === 'true')}>
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : (
                <input
                  value={formatInput(inputs[variable.name])}
                  type={variable.type === 'number' ? 'number' : variable.type === 'datetime' ? 'datetime-local' : 'text'}
                  onChange={(event) => setInput(variable.name, parseInput(variable, event.target.value))}
                />
              )}
            </label>
          ))}
        </div>
      </section>

      <section className="simulation-context">
        <div className="simulation-heading"><strong>Current Context</strong><span>Runtime only</span></div>
        <pre>{JSON.stringify(state.context, null, 2)}</pre>
      </section>

      <section className="simulation-trace">
        <div className="simulation-heading"><strong>Execution Trace</strong><span>{state.trace.length} entries</span></div>
        <div className="trace-list">
          {state.trace.length === 0 && <div className="trace-empty">Start or run the simulation to see execution details.</div>}
          {state.trace.map((entry, index) => (
            <div className={`trace-entry ${entry.message.startsWith('Simulation failed') || entry.message.startsWith('Simulation stopped') ? 'error' : ''}`} key={`${entry.step}-${entry.nodeId}-${index}`}>
              <span>{entry.step}</span>
              <div><strong>{entry.nodeLabel}</strong><small>{entry.nodeType}</small><p>{entry.message}</p></div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
