import type { FlowEdge, FlowGraph, FlowNodeType } from '../types/flow'
import { createFlowNode } from '../types/flow'

export function createDemoFlow(): FlowGraph {
  const specs: Array<[string, FlowNodeType, string, number, number, Record<string, unknown>?]> = [
    ['start', 'StartNode', 'Scheduler Tick', 60, 220, { triggerType: 'scheduler_tick' }],
    ['window', 'ConditionNode', 'Check Play Window', 340, 220, { left: 'isInsidePlayWindow', operator: 'equals', right: 'true', trueLabel: 'true', falseLabel: 'false' }],
    ['stop1', 'EndNode', 'Stop: Outside Window', 640, 360, { resultStatus: 'stopped' }],
    ['randomCap', 'RandomNode', 'Generate Shuffle', 640, 100, { mode: 'number_between', min: 'minRoomCount', max: 'maxRoomCount', outputVariable: 'roomCountShuffle' }],
    ['countWaiting', 'DbQueryNode', 'Count Waiting Rooms', 930, 100, { queryName: 'countWaitingRooms', table: 'rooms', operation: 'count', filters: '[{"status":"waiting"}]', outputVariable: 'waitingRooms' }],
    ['belowCap', 'ConditionNode', 'Check Capacity', 1220, 100, { left: 'waitingRooms', operator: 'less_than', right: 'roomCountShuffle', trueLabel: 'true', falseLabel: 'false' }],
    ['stop2', 'EndNode', 'Stop: Capacity Reached', 1510, 300, { resultStatus: 'stopped' }],
    ['findExisting', 'DbQueryNode', 'Find Existing Waiting Room', 1510, 40, { queryName: 'findWaitingRoom', table: 'rooms', operation: 'select', filters: '[{"status":"waiting"}]', outputVariable: 'waitingRoomExists' }],
    ['exists', 'ConditionNode', 'Check Existing Waiting Room', 1800, 40, { left: 'waitingRoomExists', operator: 'equals', right: 'true', trueLabel: 'yes', falseLabel: 'no' }],
    ['create', 'ActionNode', 'Create Waiting Room', 2090, -80, { actionName: 'createWaitingRoom' }],
    ['countPlayers', 'DbQueryNode', 'Count Normal Players', 2090, 100, { queryName: 'countNormalPlayers', table: 'players', operation: 'count', filters: '[{"kind":"normal"}]', outputVariable: 'normalPlayers' }],
    ['enough', 'ConditionNode', 'Check Minimum Normal Players', 2380, 100, { left: 'normalPlayers', operator: 'greater_or_equal', right: 'minNormalPlayers', trueLabel: 'true', falseLabel: 'false' }],
    ['createAdditional', 'ActionNode', 'Create Additional Waiting Room', 2670, 0, { actionName: 'createWaitingRoom' }],
    ['stop3', 'EndNode', 'Stop: Not Enough Players', 2670, 210, { resultStatus: 'stopped' }],
    ['success', 'EndNode', 'End Success', 2960, 0, { resultStatus: 'success' }],
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
    link('start', 'window'),
    link('window', 'randomCap', 'true'), link('window', 'stop1', 'false'),
    link('randomCap', 'countWaiting'),
    link('countWaiting', 'belowCap'), link('belowCap', 'findExisting', 'true'), link('belowCap', 'stop2', 'false'),
    link('findExisting', 'exists'),
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
      { id: 'var_play_window', name: 'isInsidePlayWindow', type: 'boolean', defaultValue: true, description: 'Whether the scheduler is inside the configured play window.', scope: 'input' },
      { id: 'var_min_room_count', name: 'minRoomCount', type: 'number', defaultValue: 5, description: 'Minimum randomized room cap.', scope: 'global' },
      { id: 'var_max_room_count', name: 'maxRoomCount', type: 'number', defaultValue: 5, description: 'Maximum randomized room cap.', scope: 'global' },
      { id: 'var_min_normal_players', name: 'minNormalPlayers', type: 'number', defaultValue: 2, description: 'Minimum players required for another room.', scope: 'input' },
      { id: 'var_room_shuffle', name: 'roomCountShuffle', type: 'number', defaultValue: 5, description: 'Random room capacity for the keeper window.', scope: 'nodeOutput' },
      { id: 'var_keeper_minutes', name: 'keeperWindowMinutes', type: 'number', defaultValue: 4, description: 'Minutes before a new shuffle is generated.', scope: 'input' },
      { id: 'var_waiting_rooms', name: 'waitingRooms', type: 'number', defaultValue: 3, description: 'Mocked current waiting room count.', scope: 'input' },
      { id: 'var_waiting_room_exists', name: 'waitingRoomExists', type: 'boolean', defaultValue: true, description: 'Mocked existing waiting room query result.', scope: 'input' },
      { id: 'var_normal_players', name: 'normalPlayers', type: 'number', defaultValue: 2, description: 'Mocked current normal player count.', scope: 'input' },
    ],
    inputs: [
      { name: 'isInsidePlayWindow', type: 'boolean', description: 'Whether this scheduler tick is inside the play window.' },
      { name: 'waitingRooms', type: 'number', description: 'Mocked waiting room count.' },
      { name: 'normalPlayers', type: 'number', description: 'Mocked normal player count.' },
    ],
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
