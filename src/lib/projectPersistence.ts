import type { Viewport } from '@xyflow/react'
import type { EditorSelection } from '../store/flowStore'
import type { FlowGraph } from '../types/flow'
import { normalizeFlowGraph } from './flowVariables'

export const PROJECT_FORMAT = 'flow-logic-studio'
export const PROJECT_VERSION = '0.2'
export const AUTOSAVE_STORAGE_KEY = 'flow-logic-studio-v01'

export interface FlowProject {
  format: typeof PROJECT_FORMAT
  version: string
  graph: FlowGraph
  metadata: {
    name: string
    createdAt: string
    updatedAt: string
  }
  editor?: {
    viewport?: Viewport
    selection?: EditorSelection
    ai?: {
      activeProviderId?: string
    }
  }
}

export interface ParsedFlowProject {
  project: FlowProject
  warnings: string[]
}

interface FileSystemWritableFileStream {
  write(data: Blob | string): Promise<void>
  close(): Promise<void>
}

interface FileSystemFileHandle {
  name: string
  getFile(): Promise<File>
  createWritable(): Promise<FileSystemWritableFileStream>
}

interface FilePickerWindow extends Window {
  showOpenFilePicker?: (options: unknown) => Promise<FileSystemFileHandle[]>
  showSaveFilePicker?: (options: unknown) => Promise<FileSystemFileHandle>
}

let currentProjectHandle: FileSystemFileHandle | null = null

const validViewport = (value: unknown): value is Viewport => {
  if (!value || typeof value !== 'object') return false
  const viewport = value as Partial<Viewport>
  return Number.isFinite(viewport.x) && Number.isFinite(viewport.y) && Number.isFinite(viewport.zoom)
}

const validSelection = (value: unknown, graph: FlowGraph): value is NonNullable<EditorSelection> => {
  if (!value || typeof value !== 'object') return false
  const selection = value as NonNullable<EditorSelection>
  if (selection.kind === 'node') return graph.nodes.some((node) => node.id === selection.id)
  if (selection.kind === 'edge') return graph.edges.some((edge) => edge.id === selection.id)
  return false
}

export function createFlowProject(
  graph: FlowGraph,
  viewport: Viewport,
  selection: EditorSelection,
  activeProviderId: string,
): FlowProject {
  const now = new Date().toISOString()
  const updatedGraph = { ...graph, updatedAt: now }
  return {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    graph: updatedGraph,
    metadata: {
      name: updatedGraph.name,
      createdAt: updatedGraph.createdAt,
      updatedAt: now,
    },
    editor: {
      viewport,
      selection,
      ai: { activeProviderId },
    },
  }
}

export function parseFlowProject(source: string): ParsedFlowProject {
  let raw: unknown
  try {
    raw = JSON.parse(source)
  } catch {
    throw new Error('This file is not valid JSON.')
  }

  if (!raw || typeof raw !== 'object') throw new Error('Invalid project file.')
  const candidate = raw as Partial<FlowProject>
  if (candidate.format !== PROJECT_FORMAT) {
    throw new Error(`Invalid project format. Expected "${PROJECT_FORMAT}".`)
  }
  if (!candidate.graph || typeof candidate.graph !== 'object') throw new Error('Project graph is missing.')

  const graphCandidate = candidate.graph as Partial<FlowGraph>
  if (!Array.isArray(graphCandidate.nodes) || !Array.isArray(graphCandidate.edges) || !Array.isArray(graphCandidate.variables)) {
    throw new Error('Project graph must contain nodes, edges, and variables arrays.')
  }

  const graph = normalizeFlowGraph(candidate.graph)
  const warnings: string[] = []
  if (candidate.version !== PROJECT_VERSION) {
    warnings.push(`Project version ${candidate.version || 'unknown'} differs from supported version ${PROJECT_VERSION}.`)
  }

  const viewport = validViewport(candidate.editor?.viewport)
    ? candidate.editor.viewport
    : { x: 0, y: 0, zoom: 1 }
  const selection = validSelection(candidate.editor?.selection, graph)
    ? candidate.editor.selection
    : null
  const now = new Date().toISOString()

  return {
    project: {
      format: PROJECT_FORMAT,
      version: candidate.version || 'unknown',
      graph,
      metadata: {
        name: candidate.metadata?.name || graph.name,
        createdAt: candidate.metadata?.createdAt || graph.createdAt || now,
        updatedAt: candidate.metadata?.updatedAt || graph.updatedAt || now,
      },
      editor: {
        viewport,
        selection,
        ai: candidate.editor?.ai,
      },
    },
    warnings,
  }
}

const safeFilename = (name: string) => {
  const cleaned = name
    .trim()
    .replace(/[<>:"/\\|?*]/g, '-')
    .split('')
    .filter((character) => character.charCodeAt(0) >= 32)
    .join('')
  return `${cleaned || 'Untitled Flow'}.flx`
}

const downloadFallback = (filename: string, content: string) => {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function saveFlowProject(project: FlowProject, saveAs = false): Promise<string> {
  const content = JSON.stringify(project, null, 2)
  const filename = safeFilename(project.metadata.name)
  const pickerWindow = window as FilePickerWindow

  if (!saveAs && currentProjectHandle) {
    const writable = await currentProjectHandle.createWritable()
    await writable.write(content)
    await writable.close()
    return currentProjectHandle.name
  }

  if (pickerWindow.showSaveFilePicker) {
    const handle = await pickerWindow.showSaveFilePicker({
      suggestedName: filename,
      types: [{ description: 'Flow Logic Studio Project', accept: { 'application/json': ['.flx'] } }],
    })
    const writable = await handle.createWritable()
    await writable.write(content)
    await writable.close()
    currentProjectHandle = handle
    return handle.name
  }

  downloadFallback(filename, content)
  return filename
}

const openWithInput = () => new Promise<{ file: File; source: string }>((resolve, reject) => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.flx,application/json'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return reject(new Error('No project file selected.'))
    resolve({ file, source: await file.text() })
  }
  input.click()
})

export async function openFlowProject(): Promise<ParsedFlowProject & { filename: string }> {
  const pickerWindow = window as FilePickerWindow
  if (pickerWindow.showOpenFilePicker) {
    const [handle] = await pickerWindow.showOpenFilePicker({
      multiple: false,
      types: [{ description: 'Flow Logic Studio Project', accept: { 'application/json': ['.flx'] } }],
    })
    const file = await handle.getFile()
    const parsed = parseFlowProject(await file.text())
    currentProjectHandle = handle
    return { ...parsed, filename: file.name }
  }

  const { file, source } = await openWithInput()
  currentProjectHandle = null
  return { ...parseFlowProject(source), filename: file.name }
}

export function clearCurrentProjectHandle() {
  currentProjectHandle = null
}

export function hasAutosavedSession(): boolean {
  try {
    const stored = localStorage.getItem(AUTOSAVE_STORAGE_KEY)
    if (!stored) return false
    const parsed = JSON.parse(stored) as { state?: { graph?: Partial<FlowGraph> } }
    const graph = parsed.state?.graph
    return Boolean(
      graph
      && (
        (graph.nodes?.length || 0) > 0
        || (graph.edges?.length || 0) > 0
        || (graph.variables?.length || 0) > 0
        || (graph.name && graph.name !== 'Untitled Flow')
      )
    )
  } catch {
    return false
  }
}
