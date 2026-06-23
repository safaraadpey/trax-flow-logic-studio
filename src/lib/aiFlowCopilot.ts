import type { FlowEdge, FlowGraph, FlowNode, FlowNodeType, FlowVariable } from '../types/flow'
import { createFlowNode } from '../types/flow'
import { createFlowVariable } from './flowVariables'

const AI_KEYWORDS = ['scheduler', 'room', 'random', 'waiting', 'player', 'bingo']

function edge(source: string, target: string, label = ''): FlowEdge {
  return {
    id: `ai_edge_${source}_${target}_${label || 'next'}`,
    source,
    target,
    sourceHandle: label === 'true' || label === 'false' ? label : undefined,
    data: { label, condition: label },
  }
}

function semanticNode(
  id: string,
  type: FlowNodeType,
  label: string,
  description: string,
  x: number,
  y: number,
  config?: Record<string, unknown>,
): FlowNode {
  const node = createFlowNode(type, { x, y }, id)
  node.data.label = label
  node.data.description = description
  node.data.config = { ...node.data.config, ...config }
  return node
}

function bingoSchedulerFlow(prompt: string): FlowGraph {
  const now = new Date().toISOString()
  const nodes = [
    semanticNode('ai_start', 'StartNode', 'Scheduler Tick', 'Starts whenever the bingo scheduler emits a tick.', 40, 220, { triggerType: 'scheduler_tick' }),
    semanticNode('ai_load_config', 'ActionNode', 'Load Template Config', 'Loads play-window and room-capacity settings for the active template.', 300, 220, { actionName: 'loadTemplateConfig', inputMapping: '{"templateId":"context.templateId"}', outputMapping: '{"config":"templateConfig"}' }),
    semanticNode('ai_play_window', 'ConditionNode', 'Inside Play Window?', 'Checks whether the current scheduler tick is inside the configured play window.', 580, 220, { left: 'context.now', operator: 'between', right: 'config.playWindow', trueLabel: 'true', falseLabel: 'false' }),
    semanticNode('ai_random_cap', 'RandomNode', 'Generate RoomCountShuffle', 'Generates the temporary maximum number of waiting rooms.', 860, 40, { mode: 'number_between', min: 'config.minRoomCount', max: 'config.maxRoomCount', outputVariable: 'roomCountShuffle' }),
    semanticNode('ai_random_keeper', 'RandomNode', 'Generate Keeper Window Minutes', 'Generates how long the room cap should remain active.', 1140, 40, { mode: 'number_between', min: 2, max: 15, outputVariable: 'keeperWindowMinutes' }),
    semanticNode('ai_wait_keeper', 'TimerNode', 'Wait Keeper Window', 'Waits for the generated keeper window before continuing.', 1420, 40, { mode: 'wait_for_duration', durationSource: 'variable', durationVariable: 'keeperWindowMinutes', unit: 'minutes' }),
    semanticNode('ai_count_waiting', 'DbQueryNode', 'Count Waiting Rooms', 'Models a count query for rooms currently waiting for players.', 1700, 100, { queryName: 'countWaitingRooms', table: 'rooms', operation: 'count', filters: '[{"status":"waiting","templateId":"context.templateId"}]', outputVariable: 'waitingRooms' }),
    semanticNode('ai_below_cap', 'ConditionNode', 'waitingRooms < roomCountShuffle?', 'Continues only while the randomized waiting-room capacity has not been reached.', 1700, 100, { left: 'waitingRooms', operator: 'less_than', right: 'roomCountShuffle', trueLabel: 'true', falseLabel: 'false' }),
    semanticNode('ai_find_waiting', 'DbQueryNode', 'Find Existing Waiting Room', 'Models a query for an existing waiting room for this template.', 1980, 20, { queryName: 'findExistingWaitingRoom', table: 'rooms', operation: 'select', filters: '[{"status":"waiting","templateId":"context.templateId"}]', outputVariable: 'waitingRoom' }),
    semanticNode('ai_waiting_exists', 'ConditionNode', 'waitingRoom exists?', 'Branches depending on whether a waiting room already exists.', 2260, 20, { left: 'waitingRoom', operator: 'exists', right: '', trueLabel: 'true', falseLabel: 'false' }),
    semanticNode('ai_create_room', 'ActionNode', 'Create Waiting Room', 'Creates the first waiting room when none currently exists.', 2540, -80, { actionName: 'createWaitingRoom', inputMapping: '{"templateId":"context.templateId"}', outputMapping: '{"room":"createdRoom"}' }),
    semanticNode('ai_count_players', 'DbQueryNode', 'Count Normal Players', 'Counts normal players before deciding whether another room is needed.', 2540, 100, { queryName: 'countNormalPlayers', table: 'players', operation: 'count', filters: '[{"kind":"normal","roomId":"waitingRoom.id"}]', outputVariable: 'normalPlayers' }),
    semanticNode('ai_enough_players', 'ConditionNode', 'normalPlayers >= minNormalPlayers?', 'Checks whether demand is high enough to create an additional waiting room.', 2820, 100, { left: 'normalPlayers', operator: 'greater_or_equal', right: 'config.minNormalPlayers', trueLabel: 'true', falseLabel: 'false' }),
    semanticNode('ai_create_additional', 'ActionNode', 'Create Additional Waiting Room', 'Creates another room after the minimum-player threshold is met.', 3100, 0, { actionName: 'createWaitingRoom', inputMapping: '{"templateId":"context.templateId","reason":"capacity"}', outputMapping: '{"room":"createdRoom"}' }),
    semanticNode('ai_stop', 'EndNode', 'Stop', 'Stops without creating another room.', 3100, 220, { resultStatus: 'stopped' }),
    semanticNode('ai_success', 'EndNode', 'Success', 'Finishes after a waiting room has been created.', 3400, -20, { resultStatus: 'success' }),
  ]

  const edges = [
    edge('ai_start', 'ai_load_config'),
    edge('ai_load_config', 'ai_play_window'),
    edge('ai_play_window', 'ai_random_cap', 'true'),
    edge('ai_play_window', 'ai_stop', 'false'),
    edge('ai_random_cap', 'ai_random_keeper'),
    edge('ai_random_keeper', 'ai_wait_keeper'),
    edge('ai_wait_keeper', 'ai_count_waiting'),
    edge('ai_count_waiting', 'ai_below_cap'),
    edge('ai_below_cap', 'ai_find_waiting', 'true'),
    edge('ai_below_cap', 'ai_stop', 'false'),
    edge('ai_find_waiting', 'ai_waiting_exists'),
    edge('ai_waiting_exists', 'ai_count_players', 'true'),
    edge('ai_waiting_exists', 'ai_create_room', 'false'),
    edge('ai_create_room', 'ai_success'),
    edge('ai_count_players', 'ai_enough_players'),
    edge('ai_enough_players', 'ai_create_additional', 'true'),
    edge('ai_enough_players', 'ai_stop', 'false'),
    edge('ai_create_additional', 'ai_success'),
  ]

  const variables: FlowVariable[] = [
    createFlowVariable({ id: 'ai_var_min_room', name: 'minRoomCount', type: 'number', defaultValue: 1, description: 'Minimum room cap.', scope: 'global' }),
    createFlowVariable({ id: 'ai_var_max_room', name: 'maxRoomCount', type: 'number', defaultValue: 7, description: 'Maximum room cap.', scope: 'global' }),
    createFlowVariable({ id: 'ai_var_min_players', name: 'minNormalPlayers', type: 'number', defaultValue: 4, description: 'Minimum player threshold.', scope: 'global' }),
    createFlowVariable({ id: 'ai_var_shuffle', name: 'roomCountShuffle', type: 'number', defaultValue: 0, description: 'Randomized waiting-room capacity.', scope: 'nodeOutput' }),
    createFlowVariable({ id: 'ai_var_keeper', name: 'keeperWindowMinutes', type: 'number', defaultValue: 2, description: 'Minutes for which the randomized cap is retained.', scope: 'nodeOutput' }),
    createFlowVariable({ id: 'ai_var_waiting', name: 'waitingRooms', type: 'number', defaultValue: 0, description: 'Current number of waiting rooms.', scope: 'nodeOutput' }),
    createFlowVariable({ id: 'ai_var_room', name: 'waitingRoom', type: 'object', defaultValue: null, description: 'Existing waiting room, when found.', scope: 'nodeOutput' }),
    createFlowVariable({ id: 'ai_var_players', name: 'normalPlayers', type: 'number', defaultValue: 0, description: 'Normal-player count used for capacity decisions.', scope: 'nodeOutput' }),
  ]

  return {
    id: `ai_bingo_scheduler_${Date.now()}`,
    name: 'AI Bingo Scheduler',
    description: `Locally generated from: ${prompt}`,
    nodes,
    edges,
    variables,
    inputs: [
      { name: 'now', type: 'datetime', description: 'Current scheduler tick time.' },
      { name: 'templateId', type: 'string', description: 'Template being scheduled.' },
    ],
    outputs: [{ name: 'status', type: 'string', description: 'Final scheduler result.' }],
    createdAt: now,
    updatedAt: now,
  }
}

function simpleFlow(prompt: string): FlowGraph {
  const now = new Date().toISOString()
  const nodes = [
    semanticNode('ai_simple_start', 'StartNode', 'Start', 'Starts the generated workflow manually.', 80, 160, { triggerType: 'manual' }),
    semanticNode('ai_simple_condition', 'ConditionNode', 'Check Request', `Evaluates the main condition inferred from: ${prompt}`, 360, 160, { left: 'context.isValid', operator: 'equals', right: 'true', trueLabel: 'true', falseLabel: 'false' }),
    semanticNode('ai_simple_action', 'ActionNode', 'Run Action', 'Performs the primary operation when the condition passes.', 650, 60, { actionName: 'runRequestedAction', inputMapping: '{"context":"context"}', outputMapping: '{"result":"result"}' }),
    semanticNode('ai_simple_end', 'EndNode', 'End', 'Finishes the workflow with the resulting status.', 940, 160, { resultStatus: 'success' }),
  ]
  return {
    id: `ai_simple_${Date.now()}`,
    name: 'AI Generated Flow',
    description: `Locally generated from: ${prompt}`,
    nodes,
    edges: [
      edge('ai_simple_start', 'ai_simple_condition'),
      edge('ai_simple_condition', 'ai_simple_action', 'true'),
      edge('ai_simple_condition', 'ai_simple_end', 'false'),
      edge('ai_simple_action', 'ai_simple_end'),
    ],
    variables: [createFlowVariable({ id: 'ai_var_result', name: 'result', type: 'object', defaultValue: null, description: 'Result produced by the generated action.', scope: 'nodeOutput' })],
    inputs: [{ name: 'isValid', type: 'boolean', description: 'Condition evaluated by the generated flow.' }],
    outputs: [{ name: 'status', type: 'string', description: 'Final flow status.' }],
    createdAt: now,
    updatedAt: now,
  }
}

function improveFlow(prompt: string, currentFlow: FlowGraph): FlowGraph {
  const now = new Date().toISOString()
  const nodes = currentFlow.nodes.map((node, index) => ({
    ...node,
    position: {
      x: Number.isFinite(node.position.x) ? node.position.x : 80 + (index % 4) * 280,
      y: Number.isFinite(node.position.y) ? node.position.y : 80 + Math.floor(index / 4) * 170,
    },
    data: {
      ...node.data,
      description: node.data.description || `${node.data.label} participates in the improved semantic workflow.`,
      config: { ...node.data.config },
      logic: { ...node.data.logic, aiImprovementNote: prompt },
      inputs: [...node.data.inputs],
      outputs: [...node.data.outputs],
      ui: { ...node.data.ui },
    },
  }))

  const variables = [...currentFlow.variables]
  for (const node of nodes) {
    const outputVariable = String(node.data.config.outputVariable || '').trim()
    if (outputVariable && !variables.some((variable) => variable.name === outputVariable)) {
      variables.push(createFlowVariable({
        name: outputVariable,
        type: node.data.type === 'RandomNode' ? 'number' : 'object',
        defaultValue: node.data.type === 'RandomNode' ? 0 : null,
        description: `Output generated by ${node.data.label}.`,
        scope: 'nodeOutput',
      }))
    }
  }

  return {
    ...currentFlow,
    id: `ai_improved_${Date.now()}`,
    name: currentFlow.name.startsWith('AI Improved') ? currentFlow.name : `AI Improved · ${currentFlow.name}`,
    description: `${currentFlow.description || 'Semantic flow'} Improved locally from: ${prompt}`,
    nodes,
    edges: currentFlow.edges.map((item) => ({ ...item, data: { ...item.data! } })),
    variables,
    createdAt: currentFlow.createdAt || now,
    updatedAt: now,
  }
}

export function generateMockFlow(prompt: string, currentFlow?: FlowGraph): FlowGraph {
  const normalized = prompt.trim().toLowerCase()
  if (currentFlow) return improveFlow(prompt || 'Improve clarity, descriptions, and semantic metadata.', currentFlow)
  if (AI_KEYWORDS.some((keyword) => normalized.includes(keyword))) return bingoSchedulerFlow(prompt)
  return simpleFlow(prompt || 'Create a simple conditional workflow.')
}

export function explainMockFlow(flow: FlowGraph): string {
  if (flow.nodes.length === 0) return 'This flow is empty. Add nodes manually or ask AI Copilot to generate a workflow.'

  const starts = flow.nodes.filter((node) => node.data.type === 'StartNode')
  const conditions = flow.nodes.filter((node) => node.data.type === 'ConditionNode')
  const actions = flow.nodes.filter((node) => node.data.type === 'ActionNode')
  const queries = flow.nodes.filter((node) => node.data.type === 'DbQueryNode')
  const randomNodes = flow.nodes.filter((node) => node.data.type === 'RandomNode')
  const ends = flow.nodes.filter((node) => node.data.type === 'EndNode')

  const paragraphs = [
    `${flow.name} is a semantic workflow with ${flow.nodes.length} nodes and ${flow.edges.length} transitions.`,
    starts.length
      ? `It begins at ${starts.map((node) => `"${node.data.label}"`).join(', ')}.`
      : 'It currently has no explicit start node.',
  ]

  if (queries.length) paragraphs.push(`It models ${queries.length} data operation${queries.length === 1 ? '' : 's'}: ${queries.map((node) => node.data.label).join(', ')}.`)
  if (randomNodes.length) paragraphs.push(`It generates randomized values at ${randomNodes.map((node) => node.data.label).join(' and ')}.`)
  if (conditions.length) paragraphs.push(`Decision points include ${conditions.map((node) => `"${node.data.label}"`).join(', ')}, with labeled true and false branches.`)
  if (actions.length) paragraphs.push(`The main operations are ${actions.map((node) => node.data.label).join(', ')}.`)
  if (ends.length) paragraphs.push(`The flow can terminate at ${ends.map((node) => `"${node.data.label}"`).join(' or ')}.`)
  if (flow.variables.length) paragraphs.push(`Its semantic state tracks ${flow.variables.map((variable) => variable.name).join(', ')}.`)

  return paragraphs.join('\n\n')
}
