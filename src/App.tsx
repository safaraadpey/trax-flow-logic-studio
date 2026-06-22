import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background, Controls, MiniMap, ReactFlow, ReactFlowProvider, useReactFlow,
  type NodeTypes,
} from '@xyflow/react'
import {
  AlignHorizontalSpaceAround, Box, Braces, CheckCircle2, ChevronDown, Clock3,
  Database, Dice5, Download, FileJson, Flag, FolderOpen, GitBranch,
  Grid3X3, PanelBottom, Play, Plus, Save, ScrollText, Trash2, Upload, XCircle,
} from 'lucide-react'
import mermaid from 'mermaid'
import { nodeLabels, nodeTypes as supportedNodeTypes, type FlowNodeType, type FlowPort } from './types/flow'
import { useFlowStore } from './store/flowStore'
import { SemanticNode } from './components/nodes/SemanticNode'
import { exportMermaid } from './lib/exportMermaid'
import { exportTypescript } from './lib/exportTypescript'
import { validateFlow } from './lib/validateFlow'
import { importMermaid } from './lib/importMermaid'

const semanticNodeTypes: NodeTypes = { semantic: SemanticNode }
type BottomTab = 'json' | 'mermaid' | 'typescript' | 'validation'

const paletteMeta: Record<FlowNodeType, { icon: typeof Flag; color: string; description: string }> = {
  StartNode: { icon: Flag, color: '#34d399', description: 'Trigger the flow' },
  EndNode: { icon: CheckCircle2, color: '#fb7185', description: 'Finish with status' },
  ActionNode: { icon: Box, color: '#60a5fa', description: 'Run an operation' },
  ConditionNode: { icon: GitBranch, color: '#fbbf24', description: 'Branch on logic' },
  RandomNode: { icon: Dice5, color: '#c084fc', description: 'Generate a value' },
  TimerNode: { icon: Clock3, color: '#22d3ee', description: 'Wait or schedule' },
  DbQueryNode: { icon: Database, color: '#2dd4bf', description: 'Model a query' },
  AssignVariableNode: { icon: Braces, color: '#a3e635', description: 'Set a variable' },
  LogNode: { icon: ScrollText, color: '#fb923c', description: 'Write a log entry' },
}

const configFields: Record<FlowNodeType, Array<{ key: string; label: string; type?: 'select' | 'number' | 'textarea' | 'datetime'; options?: string[] }>> = {
  StartNode: [{ key: 'triggerType', label: 'Trigger type', type: 'select', options: ['manual', 'scheduler_tick', 'webhook', 'event'] }],
  EndNode: [{ key: 'resultStatus', label: 'Result status', type: 'select', options: ['success', 'stopped', 'failed'] }],
  ActionNode: [
    { key: 'actionName', label: 'Action name' },
    { key: 'inputMapping', label: 'Input mapping', type: 'textarea' },
    { key: 'outputMapping', label: 'Output mapping', type: 'textarea' },
  ],
  ConditionNode: [
    { key: 'left', label: 'Left expression' },
    { key: 'operator', label: 'Operator', type: 'select', options: ['equals', 'not_equals', 'greater_than', 'less_than', 'greater_or_equal', 'less_or_equal', 'between', 'contains', 'exists', 'not_exists'] },
    { key: 'right', label: 'Right expression' },
    { key: 'trueLabel', label: 'True label' },
    { key: 'falseLabel', label: 'False label' },
  ],
  RandomNode: [
    { key: 'mode', label: 'Mode', type: 'select', options: ['number_between', 'coin_flip', 'pick_from_list'] },
    { key: 'min', label: 'Minimum' }, { key: 'max', label: 'Maximum' },
    { key: 'listValues', label: 'List values', type: 'textarea' },
    { key: 'outputVariable', label: 'Output variable' },
  ],
  TimerNode: [
    { key: 'mode', label: 'Mode', type: 'select', options: ['wait_for_duration', 'wait_until'] },
    { key: 'durationValue', label: 'Duration', type: 'number' },
    { key: 'durationUnit', label: 'Unit', type: 'select', options: ['seconds', 'minutes', 'hours'] },
    { key: 'untilDatetime', label: 'Until datetime', type: 'datetime' },
  ],
  DbQueryNode: [
    { key: 'queryName', label: 'Query name' }, { key: 'table', label: 'Table' },
    { key: 'operation', label: 'Operation', type: 'select', options: ['select', 'insert', 'update', 'delete', 'count'] },
    { key: 'filters', label: 'Filters JSON', type: 'textarea' }, { key: 'outputVariable', label: 'Output variable' },
  ],
  AssignVariableNode: [{ key: 'variableName', label: 'Variable name' }, { key: 'valueExpression', label: 'Value expression', type: 'textarea' }],
  LogNode: [{ key: 'message', label: 'Message', type: 'textarea' }, { key: 'level', label: 'Level', type: 'select', options: ['info', 'warn', 'error'] }],
}

function download(name: string, content: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(url)
}

function Toolbar({ onImport }: { onImport: () => void }) {
  const { graph, newFlow, loadDemo, save, autoLayout, savedAt } = useFlowStore()
  const mermaidText = useMemo(() => exportMermaid(graph), [graph])
  return (
    <header className="toolbar">
      <div className="brand">
        <div className="brand-mark"><GitBranch size={18} /></div>
        <div><strong>Flow Logic</strong><span>STUDIO · v0.1</span></div>
      </div>
      <div className="toolbar-actions">
        <button onClick={newFlow}><Plus size={15} />New Flow</button>
        <button onClick={save}><Save size={15} />Save</button>
        <button onClick={loadDemo} className="accent"><Play size={15} />Load Demo</button>
        <span className="separator" />
        <button onClick={autoLayout}><AlignHorizontalSpaceAround size={15} />Auto layout</button>
        <button onClick={onImport}><Upload size={15} />Import Mermaid</button>
        <button onClick={() => download(`${graph.name}.json`, JSON.stringify(graph, null, 2), 'application/json')}><FileJson size={15} />JSON</button>
        <button onClick={() => download(`${graph.name}.mmd`, mermaidText)}><Download size={15} />Mermaid</button>
      </div>
      <div className="save-state"><span className="status-dot" />{savedAt ? `Saved ${new Date(savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Locally persisted'}</div>
    </header>
  )
}

function Palette() {
  const onDragStart = (event: React.DragEvent, type: FlowNodeType) => {
    event.dataTransfer.setData('application/flow-node', type)
    event.dataTransfer.effectAllowed = 'move'
  }
  return (
    <aside className="palette">
      <div className="panel-title"><span>NODE PALETTE</span><Grid3X3 size={14} /></div>
      <p className="panel-hint">Drag a semantic node onto the canvas.</p>
      <div className="palette-list">
        {supportedNodeTypes.map((type) => {
          const item = paletteMeta[type]
          const Icon = item.icon
          return (
            <div className="palette-item" draggable onDragStart={(event) => onDragStart(event, type)} key={type}>
              <div className="palette-icon" style={{ color: item.color, background: `${item.color}18` }}><Icon size={16} /></div>
              <div><strong>{nodeLabels[type]}</strong><span>{item.description}</span></div>
            </div>
          )
        })}
      </div>
      <div className="palette-tip"><strong>Quick tip</strong><span>Connect from a node’s right handle to the next node.</span></div>
    </aside>
  )
}

function PortEditor({ title, ports, onChange }: { title: string; ports: FlowPort[]; onChange: (ports: FlowPort[]) => void }) {
  const add = () => onChange([...ports, { name: '', type: 'string', description: '' }])
  return (
    <section className="inspector-section">
      <div className="section-title"><span>{title}</span><button className="icon-button" onClick={add}><Plus size={13} /></button></div>
      {ports.length === 0 && <div className="empty-small">No {title.toLowerCase()} defined</div>}
      {ports.map((port, index) => (
        <div className="port-row" key={index}>
          <input value={port.name} placeholder="name" onChange={(e) => onChange(ports.map((p, i) => i === index ? { ...p, name: e.target.value } : p))} />
          <select value={port.type} onChange={(e) => onChange(ports.map((p, i) => i === index ? { ...p, type: e.target.value as FlowPort['type'] } : p))}>
            {['string', 'number', 'boolean', 'datetime', 'object', 'array'].map((type) => <option key={type}>{type}</option>)}
          </select>
          <button className="icon-button danger" onClick={() => onChange(ports.filter((_, i) => i !== index))}><Trash2 size={12} /></button>
        </div>
      ))}
    </section>
  )
}

function Inspector() {
  const { graph, selection, updateNode, updateNodeConfig, updateEdge, removeSelected } = useFlowStore()
  const node = selection?.kind === 'node' ? graph.nodes.find((item) => item.id === selection.id) : undefined
  const edge = selection?.kind === 'edge' ? graph.edges.find((item) => item.id === selection.id) : undefined

  return (
    <aside className="inspector">
      <div className="panel-title"><span>INSPECTOR</span>{selection && <button className="icon-button danger" onClick={removeSelected}><Trash2 size={14} /></button>}</div>
      {!selection && <div className="empty-inspector"><div><Braces size={22} /></div><strong>Nothing selected</strong><span>Select a node or edge to edit its semantic properties.</span></div>}
      {node && (
        <div className="inspector-content">
          <div className="selected-kind" style={{ color: paletteMeta[node.data.type].color }}>{nodeLabels[node.data.type]} <span>{node.id}</span></div>
          <section className="inspector-section">
            <label>Label<input value={node.data.label} onChange={(e) => updateNode(node.id, { label: e.target.value })} /></label>
            <label>Description<textarea rows={2} value={node.data.description} onChange={(e) => updateNode(node.id, { description: e.target.value })} /></label>
          </section>
          <section className="inspector-section">
            <div className="section-title">LOGIC & CONFIG</div>
            {configFields[node.data.type].map((field) => {
              const value = String(node.data.config[field.key] ?? '')
              return (
                <label key={field.key}>{field.label}
                  {field.type === 'select' ? (
                    <select value={value} onChange={(e) => updateNodeConfig(node.id, field.key, e.target.value)}>
                      {field.options?.map((option) => <option key={option}>{option}</option>)}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea rows={2} value={value} onChange={(e) => updateNodeConfig(node.id, field.key, e.target.value)} />
                  ) : (
                    <input type={field.type || 'text'} value={value} onChange={(e) => updateNodeConfig(node.id, field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)} />
                  )}
                </label>
              )
            })}
          </section>
          <PortEditor title="Inputs" ports={node.data.inputs} onChange={(inputs) => updateNode(node.id, { inputs })} />
          <PortEditor title="Outputs" ports={node.data.outputs} onChange={(outputs) => updateNode(node.id, { outputs })} />
          <details className="json-details"><summary>Node JSON <ChevronDown size={13} /></summary><pre>{JSON.stringify(node, null, 2)}</pre></details>
        </div>
      )}
      {edge && (
        <div className="inspector-content">
          <div className="selected-kind edge-kind">EDGE <span>{edge.id}</span></div>
          <section className="inspector-section">
            <label>Label<input value={edge.data?.label || ''} onChange={(e) => updateEdge(edge.id, { label: e.target.value })} /></label>
            <label>Condition<textarea rows={3} value={edge.data?.condition || ''} onChange={(e) => updateEdge(edge.id, { condition: e.target.value })} /></label>
          </section>
          <details className="json-details" open><summary>Edge JSON <ChevronDown size={13} /></summary><pre>{JSON.stringify(edge, null, 2)}</pre></details>
        </div>
      )}
    </aside>
  )
}

function MermaidPreview({ source }: { source: string }) {
  const [svg, setSvg] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' })
    mermaid.render(`mermaid-${Date.now()}`, source)
      .then(({ svg: output }) => { if (active) { setSvg(output); setError('') } })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : String(reason)) })
    return () => { active = false }
  }, [source])
  return error ? <div className="preview-error">{error}</div> : <div className="mermaid-preview" dangerouslySetInnerHTML={{ __html: svg }} />
}

function BottomPanel() {
  const graph = useFlowStore((state) => state.graph)
  const [tab, setTab] = useState<BottomTab>('validation')
  const [expanded, setExpanded] = useState(true)
  const mermaidText = useMemo(() => exportMermaid(graph), [graph])
  const typescriptText = useMemo(() => exportTypescript(graph), [graph])
  const issues = useMemo(() => validateFlow(graph), [graph])
  const content = tab === 'json' ? JSON.stringify(graph, null, 2) : tab === 'mermaid' ? mermaidText : typescriptText
  return (
    <section className={`bottom-panel ${expanded ? '' : 'collapsed'}`}>
      <div className="bottom-tabs">
        <button className="collapse-button" onClick={() => setExpanded(!expanded)}><PanelBottom size={14} /></button>
        {(['json', 'mermaid', 'typescript', 'validation'] as BottomTab[]).map((name) => (
          <button className={tab === name ? 'active' : ''} onClick={() => { setTab(name); setExpanded(true) }} key={name}>
            {name === 'validation' && <span className={`issue-count ${issues.some((i) => i.level === 'error') ? 'has-error' : ''}`}>{issues.length}</span>}
            {name === 'typescript' ? 'TypeScript' : name[0].toUpperCase() + name.slice(1)}
          </button>
        ))}
      </div>
      {expanded && (
        <div className="bottom-content">
          {tab === 'validation' ? (
            <div className="validation-list">
              {issues.length === 0 ? <div className="valid-message"><CheckCircle2 size={18} />Flow is valid and ready to export.</div> : issues.map((issue, index) => (
                <div className={`validation-item ${issue.level}`} key={`${issue.message}-${index}`}>
                  {issue.level === 'error' ? <XCircle size={15} /> : <Clock3 size={15} />}
                  <div><strong>{issue.level}</strong><span>{issue.message}</span></div>
                </div>
              ))}
            </div>
          ) : tab === 'mermaid' ? (
            <div className="split-preview"><pre>{content}</pre><MermaidPreview source={mermaidText} /></div>
          ) : <pre>{content}</pre>}
        </div>
      )}
    </section>
  )
}

function Canvas() {
  const wrapper = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition, fitView } = useReactFlow()
  const { graph, onNodesChange, onEdgesChange, onConnect, select, addNode } = useFlowStore()
  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    const type = event.dataTransfer.getData('application/flow-node') as FlowNodeType
    if (!supportedNodeTypes.includes(type)) return
    addNode(type, screenToFlowPosition({ x: event.clientX, y: event.clientY }))
  }, [addNode, screenToFlowPosition])

  useEffect(() => {
    const timeout = setTimeout(() => { if (graph.nodes.length) fitView({ padding: 0.15, duration: 350 }) }, 50)
    return () => clearTimeout(timeout)
  }, [graph.id, graph.nodes.length, fitView])

  return (
    <main className="canvas" ref={wrapper} onDrop={onDrop} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move' }}>
      <div className="canvas-title"><strong>{graph.name}</strong><span>{graph.nodes.length} nodes · {graph.edges.length} edges</span></div>
      <ReactFlow
        nodes={graph.nodes}
        edges={graph.edges}
        nodeTypes={semanticNodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => select({ kind: 'node', id: node.id })}
        onEdgeClick={(_, edge) => select({ kind: 'edge', id: edge.id })}
        onPaneClick={() => select(null)}
        deleteKeyCode={null}
        fitView
        defaultEdgeOptions={{ animated: true, style: { stroke: '#64748b' }, labelStyle: { fill: '#cbd5e1', fontSize: 11 } }}
      >
        <Background color="#263044" gap={22} size={1} />
        <Controls position="bottom-left" />
        <MiniMap position="bottom-right" nodeColor={(node) => paletteMeta[node.data.type as FlowNodeType]?.color || '#64748b'} maskColor="rgba(5,8,15,.82)" />
      </ReactFlow>
    </main>
  )
}

function ImportDialog({ onClose }: { onClose: () => void }) {
  const setGraph = useFlowStore((state) => state.setGraph)
  const current = useFlowStore((state) => state.graph)
  const [source, setSource] = useState('flowchart TD\n  start([Start]) --> check{Valid?}\n  check -->|true| done([Success])\n  check -->|false| stop([Stopped])')
  const [error, setError] = useState('')
  const submit = () => {
    try {
      const parsed = importMermaid(source)
      setGraph({ ...current, id: `imported_${Date.now()}`, name: 'Imported Mermaid Flow', nodes: parsed.nodes, edges: parsed.edges, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    }
  }
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-title"><div><strong>Import Mermaid</strong><span>Basic flowchart TD syntax</span></div><button className="icon-button" onClick={onClose}>×</button></div>
        <textarea value={source} onChange={(e) => setSource(e.target.value)} />
        {error && <div className="import-error">{error}</div>}
        <div className="modal-actions"><button onClick={onClose}>Cancel</button><button className="primary" onClick={submit}><FolderOpen size={14} />Import flow</button></div>
      </div>
    </div>
  )
}

function AppShell() {
  const [importOpen, setImportOpen] = useState(false)
  const removeSelected = useFlowStore((state) => state.removeSelected)
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.key === 'Delete' || event.key === 'Backspace') && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) removeSelected()
    }
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [removeSelected])
  return (
    <div className="app-shell">
      <Toolbar onImport={() => setImportOpen(true)} />
      <div className="workspace"><Palette /><Canvas /><Inspector /></div>
      <BottomPanel />
      {importOpen && <ImportDialog onClose={() => setImportOpen(false)} />}
    </div>
  )
}

export default function App() {
  return <ReactFlowProvider><AppShell /></ReactFlowProvider>
}
