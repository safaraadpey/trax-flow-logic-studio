import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Activity, Box, Braces, Clock3, Database, Dice5, Flag, GitBranch, ScrollText } from 'lucide-react'
import type { FlowNode } from '../../types/flow'

const meta = {
  StartNode: { icon: Flag, color: '#34d399', name: 'START' },
  EndNode: { icon: Activity, color: '#fb7185', name: 'END' },
  ActionNode: { icon: Box, color: '#60a5fa', name: 'ACTION' },
  ConditionNode: { icon: GitBranch, color: '#fbbf24', name: 'CONDITION' },
  RandomNode: { icon: Dice5, color: '#c084fc', name: 'RANDOM' },
  TimerNode: { icon: Clock3, color: '#22d3ee', name: 'TIMER' },
  DbQueryNode: { icon: Database, color: '#2dd4bf', name: 'DB QUERY' },
  AssignVariableNode: { icon: Braces, color: '#a3e635', name: 'ASSIGN' },
  LogNode: { icon: ScrollText, color: '#fb923c', name: 'LOG' },
}

export function SemanticNode({ data, selected }: NodeProps<FlowNode>) {
  const item = meta[data.type]
  const Icon = item.icon
  const isCondition = data.type === 'ConditionNode'

  return (
    <div className={`flow-node ${selected ? 'selected' : ''}`} style={{ '--accent': item.color } as React.CSSProperties}>
      <Handle type="target" position={Position.Left} />
      <div className="node-kicker"><Icon size={12} />{item.name}</div>
      <div className="node-label">{data.label}</div>
      {data.description && <div className="node-description">{data.description}</div>}
      {isCondition ? (
        <>
          <Handle id="true" type="source" position={Position.Right} style={{ top: '36%' }} />
          <span className="handle-label true">T</span>
          <Handle id="false" type="source" position={Position.Right} style={{ top: '70%' }} />
          <span className="handle-label false">F</span>
        </>
      ) : data.type !== 'EndNode' ? <Handle type="source" position={Position.Right} /> : null}
    </div>
  )
}
