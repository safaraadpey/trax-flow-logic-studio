# Flow Logic Studio v0.2

A visual semantic flow editor for designing developer-friendly automation logic. The canvas is only a view: the source of truth is a typed `FlowGraph` JSON model that can be validated and exported.

## Run locally

```bash
npm install
npm run dev
```

Production check:

```bash
npm run build
npm run preview
```

## Architecture

- `src/types/flow.ts` — semantic graph, node, edge, port, and variable types.
- `src/store/flowStore.ts` — Zustand state, React Flow change handlers, selection, persistence, and simple auto-layout.
- `src/components/nodes/` — reusable semantic React Flow node.
- `src/lib/` — Mermaid import/export, TypeScript pseudo-code generation, validation, IDs, and demo data.
- `src/App.tsx` — desktop studio layout, palette, canvas, inspector, toolbar, previews, and validation panel.

The Zustand store persists the current graph in `localStorage` under `flow-logic-studio-v01`.

## AI Flow Copilot

The collapsible AI Copilot uses a deterministic local generator, so no API key is required.

- Natural-language prompts produce editable semantic `FlowGraph` JSON.
- Scheduler, room, random, waiting, player, or bingo prompts produce the Bingo Scheduler flow.
- Other prompts produce a simple Start → Condition → Action → End workflow.
- Generated flows are previewed and validated before they can be applied.
- The current flow can be improved, explained, or converted to Mermaid.

The editor never calls vendor implementations directly. Requests follow:

`AI Copilot → AIService → active AIProvider`

Provider architecture:

- `src/ai/AIProvider.ts` — shared asynchronous provider contract.
- `src/ai/providerRegistry.ts` — extensible provider registration.
- `src/ai/aiService.ts` — the only request gateway used by the editor.
- `src/ai/providers/` — Mock, OpenAI, Claude, and Gemini adapters.
- `src/store/aiSettingsStore.ts` — persisted active-provider selection.

Mock is ready by default. Gemini can be enabled with `GEMINI_API_KEY` and `VITE_GEMINI_ENABLED=true`. Local development proxies `/api/gemini` through Vite, while Vercel serves the same route from `api/gemini.ts`. The API key remains server-side. OpenAI and Claude remain registered placeholders.

### Vercel Gemini configuration

Add these project environment variables for Production and Preview, then redeploy:

```text
GEMINI_API_KEY=your_gemini_api_key
VITE_GEMINI_ENABLED=true
VITE_GEMINI_MODEL=gemini-3.5-flash
```

The browser sends AI requests to `/api/gemini`; the Vercel Function forwards them to the official Gemini API.

## Semantic data model

`FlowGraph` owns nodes, edges, variables, inputs, outputs, and timestamps. Every node stores:

- semantic `type`
- label and description
- typed input/output ports
- type-specific `config`
- free-form `logic`
- UI metadata

Supported nodes: Start, End, Action, Condition, Random, Timer, DB Query, Assign Variable, and Log.

## Export and import

- JSON exports the complete semantic graph.
- Mermaid is generated from semantic nodes and edges; it is never the source of truth.
- TypeScript output is readable pseudo-code intended as a developer handoff.
- Mermaid import intentionally supports a safe subset of `flowchart TD`: basic node shapes, arrows, and edge labels.

## Known v0.1 limitations

- No backend, authentication, collaboration, or real database execution.
- Auto-layout is a lightweight level-based layout, not a full graph layout engine.
- Mermaid import does not support subgraphs, styling directives, or every Mermaid edge syntax.
- TypeScript output is structural pseudo-code and is not guaranteed to execute.
- Variable management is represented in the graph model; a dedicated variables UI is planned for v0.2.
