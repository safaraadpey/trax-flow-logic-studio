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
      { id: 'var_min_room_count', name: 'minRoomCount', type: 'number', defaultValue: 1, description: 'Minimum randomized room cap.', scope: 'global' },
      { id: 'var_max_room_count', name: 'maxRoomCount', type: 'number', defaultValue: 7, description: 'Maximum randomized room cap.', scope: 'global' },
      { id: 'var_min_normal_players', name: 'minNormalPlayers', type: 'number', defaultValue: 4, description: 'Minimum players required for another room.', scope: 'global' },
      { id: 'var_room_shuffle', name: 'roomCountShuffle', type: 'number', defaultValue: 0, description: 'Random room capacity for the keeper window.', scope: 'nodeOutput' },
      { id: 'var_keeper_minutes', name: 'keeperMinutes', type: 'number', defaultValue: 2, description: 'Minutes before a new shuffle is generated.', scope: 'nodeOutput' },
      { id: 'var_waiting_rooms', name: 'waitingRooms', type: 'number', defaultValue: 0, description: 'Current waiting room count.', scope: 'nodeOutput' },
      { id: 'var_normal_players', name: 'normalPlayers', type: 'number', defaultValue: 0, description: 'Current normal player count.', scope: 'nodeOutput' },
    ],
    inputs: [{ name: 'now', type: 'datetime', description: 'Scheduler tick time.' }],
    outputs: [{ name: 'status', type: 'string', description: 'Final scheduler status.' }],
    createdAt: now,
    updatedAt: now,
  }
}

export function createCardNumberDemo(): FlowGraph {
  const specs: Array<[string, FlowNodeType, string, number, number, Record<string, unknown>?]> = [
    ['card_start', 'StartNode', 'Start Card Loop', 80, 180, { triggerType: 'manual' }],
    ['card_check', 'ConditionNode', 'currentCardNumber < maxCardNumber?', 370, 180, { left: 'currentCardNumber', operator: 'less_than', right: 'maxCardNumber', trueLabel: 'true', falseLabel: 'false' }],
    ['card_read', 'LogNode', 'Read Current Card Number', 680, 70, { message: 'Current card: ${currentCardNumber}', level: 'info' }],
    ['card_increment', 'AssignVariableNode', 'Increment Current Card Number', 970, 70, { variableName: 'currentCardNumber', valueExpression: 'currentCardNumber + 1' }],
    ['card_continue', 'AssignVariableNode', 'Set Should Continue', 1260, 70, { variableName: 'shouldContinue', valueExpression: 'currentCardNumber < maxCardNumber' }],
    ['card_end', 'EndNode', 'End Card Loop', 680, 290, { resultStatus: 'success' }],
  ]

  const nodes = specs.map(([nodeId, type, label, x, y, config]) => {
    const node = createFlowNode(type, { x, y }, nodeId)
    node.data.label = label
    node.data.description = label
    if (config) node.data.config = { ...node.data.config, ...config }
    return node
  })

  const link = (source: string, target: string, label = ''): FlowEdge => ({
    id: `e_${source}_${target}_${label || 'next'}`,
    source,
    target,
    sourceHandle: label === 'true' || label === 'false' ? label : undefined,
    data: { label, condition: label },
  })

  const now = new Date().toISOString()
  return {
    id: 'card_number_increment_demo',
    name: 'Card Number Increment Loop',
    description: 'Reads and increments a card number until the configured maximum is reached.',
    nodes,
    edges: [
      link('card_start', 'card_check'),
      link('card_check', 'card_read', 'true'),
      link('card_check', 'card_end', 'false'),
      link('card_read', 'card_increment'),
      link('card_increment', 'card_continue'),
      link('card_continue', 'card_check'),
    ],
    variables: [
      { id: 'var_current_card', name: 'currentCardNumber', type: 'number', defaultValue: 1, description: 'Card number currently being processed.', scope: 'global' },
      { id: 'var_max_card', name: 'maxCardNumber', type: 'number', defaultValue: 75, description: 'Highest card number allowed.', scope: 'input' },
      { id: 'var_should_continue', name: 'shouldContinue', type: 'boolean', defaultValue: true, description: 'Computed loop continuation flag.', scope: 'computed' },
    ],
    inputs: [{ name: 'maxCardNumber', type: 'number', description: 'Maximum card number.' }],
    outputs: [{ name: 'currentCardNumber', type: 'number', description: 'Final card number.' }],
    createdAt: now,
    updatedAt: now,
  }
}
