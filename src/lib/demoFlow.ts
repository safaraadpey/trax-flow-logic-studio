import type { FlowEdge, FlowGraph, FlowNodeType } from '../types/flow'
import { createFlowNode } from '../types/flow'

export function createDemoFlow(): FlowGraph {
  const specs: Array<[string, FlowNodeType, string, number, number, Record<string, unknown>?]> = [
    ['start', 'StartNode', 'Scheduler Tick', 60, 220, { triggerType: 'scheduler_tick' }],
    ['load', 'ActionNode', 'Load Template Config', 330, 220, { actionName: 'loadTemplateConfig' }],
    ['window', 'ConditionNode', 'Inside Play Window?', 600, 220, { left: 'context.now', operator: 'between', right: 'config.playWindow', trueLabel: 'true', falseLabel: 'false' }],
    ['expired', 'ConditionNode', 'Keeper Window Expired?', 890, 130, { left: 'keeper.expiresAt', operator: 'less_than', right: 'context.now', trueLabel: 'expired', falseLabel: 'active' }],
    ['stop1', 'EndNode', 'Stop: Outside Window', 890, 350, { resultStatus: 'stopped' }],
    ['randomCap', 'RandomNode', 'Generate Room Count Shuffle', 1190, 40, { mode: 'number_between', min: 'minRoomCount', max: 'maxRoomCount', outputVariable: 'roomCountShuffle' }],
    ['randomKeeper', 'RandomNode', 'Generate Keeper Window', 1480, 40, { mode: 'number_between', min: 2, max: 15, outputVariable: 'keeperMinutes' }],
    ['store', 'ActionNode', 'Store Shuffle State', 1770, 40, { actionName: 'storeShuffleState' }],
    ['countWaiting', 'DbQueryNode', 'Count Waiting Rooms', 2060, 130, { queryName: 'countWaitingRooms', table: 'rooms', operation: 'count', filters: '[{"status":"waiting"}]', outputVariable: 'waitingRooms' }],
    ['belowCap', 'ConditionNode', 'waitingRooms < roomCountShuffle?', 2350, 130, { left: 'waitingRooms', operator: 'less_than', right: 'roomCountShuffle', trueLabel: 'true', falseLabel: 'false' }],
    ['stop2', 'EndNode', 'Stop: Capacity Reached', 2630, 330, { resultStatus: 'stopped' }],
    ['exists', 'ConditionNode', 'Existing Waiting Room?', 2640, 70, { left: 'waitingRooms', operator: 'greater_than', right: '0', trueLabel: 'yes', falseLabel: 'no' }],
    ['create', 'ActionNode', 'Create Waiting Room', 2930, -20, { actionName: 'createWaitingRoom' }],
    ['countPlayers', 'DbQueryNode', 'Count Normal Players', 2930, 150, { queryName: 'countNormalPlayers', table: 'players', operation: 'count', filters: '[{"kind":"normal"}]', outputVariable: 'normalPlayers' }],
    ['enough', 'ConditionNode', 'normalPlayers >= minNormalPlayers?', 3220, 150, { left: 'normalPlayers', operator: 'greater_or_equal', right: 'minNormalPlayers', trueLabel: 'true', falseLabel: 'false' }],
    ['createAdditional', 'ActionNode', 'Create Additional Waiting Room', 3510, 50, { actionName: 'createWaitingRoom' }],
    ['stop3', 'EndNode', 'Stop: Not Enough Players', 3510, 250, { resultStatus: 'stopped' }],
    ['success', 'EndNode', 'End Success', 3810, 20, { resultStatus: 'success' }],
  ]

  const nodes = specs.map(([nodeId, type, label, x, y, config]) => {
    const node = createFlowNode(type, { x, y }, nodeId)
    node.data.label = label
    if (config) node.data.config = { ...node.data.config, ...config }
    return node
  })

  const link = (source: string, target: string, label = ''): FlowEdge => ({
    id: `e_${source}_${target}`,
    source,
    target,
    sourceHandle: label === 'true' || label === 'false' ? label : undefined,
    data: { label, condition: label },
  })

  const edges = [
    link('start', 'load'), link('load', 'window'),
    link('window', 'expired', 'true'), link('window', 'stop1', 'false'),
    link('expired', 'randomCap', 'true'), link('expired', 'countWaiting', 'false'),
    link('randomCap', 'randomKeeper'), link('randomKeeper', 'store'), link('store', 'countWaiting'),
    link('countWaiting', 'belowCap'), link('belowCap', 'exists', 'true'), link('belowCap', 'stop2', 'false'),
    link('exists', 'countPlayers', 'true'), link('exists', 'create', 'false'),
    link('countPlayers', 'enough'), link('enough', 'createAdditional', 'true'), link('enough', 'stop3', 'false'),
    link('create', 'success'), link('createAdditional', 'success'),
  ]

  const now = new Date().toISOString()
  return {
    id: 'bingo_scheduler_demo',
    name: 'Bingo Scheduler',
    description: 'Scheduler flow that opens waiting rooms using randomized capacity and keeper windows.',
    nodes,
    edges,
    variables: [
      { name: 'roomCountShuffle', type: 'number', defaultValue: 0, description: 'Random room capacity for the keeper window.' },
      { name: 'keeperMinutes', type: 'number', defaultValue: 2, description: 'Minutes before a new shuffle is generated.' },
      { name: 'waitingRooms', type: 'number', defaultValue: 0, description: 'Current waiting room count.' },
    ],
    inputs: [{ name: 'now', type: 'datetime', description: 'Scheduler tick time.' }],
    outputs: [{ name: 'status', type: 'string', description: 'Final scheduler status.' }],
    createdAt: now,
    updatedAt: now,
  }
}
