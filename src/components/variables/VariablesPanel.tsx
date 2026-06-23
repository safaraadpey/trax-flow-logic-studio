import { useState } from 'react'
import { ChevronDown, Plus, Trash2, Variable } from 'lucide-react'
import type { FlowVariable, VariableScope, VariableType } from '../../types/flow'
import { formatVariableDefault, parseVariableDefault, variableScopes, variableTypes } from '../../lib/flowVariables'
import { useFlowStore } from '../../store/flowStore'

export function VariablesPanel() {
  const { graph, addVariable, updateVariable, removeVariable } = useFlowStore()
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())

  const update = (variable: FlowVariable, patch: Partial<FlowVariable>) => updateVariable(variable.id, patch)
  const toggle = (variableId: string) => setExpandedIds((current) => {
    const next = new Set(current)
    if (next.has(variableId)) next.delete(variableId)
    else next.add(variableId)
    return next
  })

  return (
    <div className="variables-panel">
      <div className="variables-toolbar">
        <div><strong>Shared registry</strong><span>{graph.variables.length} variables</span></div>
        <button onClick={() => addVariable({ name: `variable${graph.variables.length + 1}` })}><Plus size={13} />Add</button>
      </div>
      {graph.variables.length === 0 && (
        <div className="variables-empty"><Variable size={20} /><strong>No variables yet</strong><span>Create shared state for conditions, outputs, queries, and assignments.</span></div>
      )}
      <div className="variable-list">
        {graph.variables.map((variable) => (
          <div className={`variable-card ${expandedIds.has(variable.id) ? 'expanded' : ''}`} key={variable.id}>
            <div className="variable-card-title">
              <button className="variable-card-toggle" onClick={() => toggle(variable.id)}>
                <Variable size={13} />
                <span>
                  <strong>{variable.name || 'Unnamed variable'}</strong>
                  <small>{variable.type} · {variable.scope}</small>
                </span>
                <ChevronDown className="variable-chevron" size={13} />
              </button>
              <button className="icon-button danger" title={`Delete ${variable.name}`} onClick={() => removeVariable(variable.id)}><Trash2 size={12} /></button>
            </div>
            {expandedIds.has(variable.id) && (
              <div className="variable-card-details">
                <label>Name<input value={variable.name} onChange={(event) => update(variable, { name: event.target.value })} /></label>
                <div className="variable-grid">
                  <label>Type
                    <select value={variable.type} onChange={(event) => update(variable, { type: event.target.value as VariableType })}>
                      {variableTypes.map((type) => <option key={type}>{type}</option>)}
                    </select>
                  </label>
                  <label>Scope
                    <select value={variable.scope} onChange={(event) => update(variable, { scope: event.target.value as VariableScope })}>
                      {variableScopes.map((scope) => <option key={scope}>{scope}</option>)}
                    </select>
                  </label>
                </div>
                <label>Default value
                  {variable.type === 'boolean' ? (
                    <select value={String(variable.defaultValue)} onChange={(event) => update(variable, { defaultValue: event.target.value === 'true' })}>
                      <option value="true">true</option><option value="false">false</option>
                    </select>
                  ) : (
                    <input value={formatVariableDefault(variable.defaultValue)} onChange={(event) => update(variable, { defaultValue: parseVariableDefault(event.target.value, variable.type) })} />
                  )}
                </label>
                <label>Description<textarea rows={2} value={variable.description || ''} onChange={(event) => update(variable, { description: event.target.value })} /></label>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
