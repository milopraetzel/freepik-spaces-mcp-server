# JavaScript Snippets für Freepik Spaces

Alle Snippets werden via `javascript_tool` im Freepik Spaces Tab ausgeführt. Ersetze `NODE_ID` bzw. `EDGE_ID` durch die tatsächliche UUID.

## Spaces prüfen

```javascript
(function() {
  const debug = window.__SPACES_PIKASO_DEBUG__;
  if (!debug || !debug.vueflow) return { loaded: false, error: 'Spaces not loaded' };
  return { loaded: true };
})()
```

## Alle Nodes auflisten

```javascript
(function() {
  const vf = window.__SPACES_PIKASO_DEBUG__.vueflow;
  const nodes = vf.nodes?.value || vf.nodes || [];
  return nodes.map(n => ({
    id: n.id,
    type: n.data?.boardElement?.type || n.type,
    name: n.data?.boardElement?.name || 'Unnamed',
    position: n.position,
    status: n.data?.boardElement?.workflowState?.status || 'unknown',
    data: {
      text: n.data?.boardElement?.data?.text,
      prompt: n.data?.boardElement?.data?.prompt,
      instructions: n.data?.boardElement?.data?.instructions,
      output: n.data?.boardElement?.data?.output,
      aspectRatio: n.data?.boardElement?.data?.aspectRatio,
      model: n.data?.boardElement?.data?.model,
      factor: n.data?.boardElement?.data?.factor,
    }
  }));
})()
```

## Alle Edges (Verbindungen) auflisten

```javascript
(function() {
  const vf = window.__SPACES_PIKASO_DEBUG__.vueflow;
  const edges = vf.edges?.value || vf.edges || [];
  return edges.map(e => ({
    id: e.id,
    source: e.source,
    sourceHandle: e.sourceHandle,
    target: e.target,
    targetHandle: e.targetHandle,
  }));
})()
```

## Einzelnen Node abrufen

```javascript
(function() {
  const vf = window.__SPACES_PIKASO_DEBUG__.vueflow;
  const nodes = vf.nodes?.value || vf.nodes || [];
  const n = nodes.find(n => n.id === 'NODE_ID');
  if (!n) return null;
  return {
    id: n.id,
    type: n.data?.boardElement?.type || n.type,
    name: n.data?.boardElement?.name || 'Unnamed',
    position: n.position,
    status: n.data?.boardElement?.workflowState?.status || 'unknown',
    data: n.data?.boardElement?.data || {},
  };
})()
```

## Text in Node schreiben (text-Nodes)

```javascript
(function() {
  const vf = window.__SPACES_PIKASO_DEBUG__.vueflow;
  const nodes = vf.nodes?.value || vf.nodes || [];
  const n = nodes.find(n => n.id === 'NODE_ID');
  if (!n) return { success: false, error: 'Node not found' };
  if (!n.data?.boardElement?.data) return { success: false, error: 'Node has no data' };
  n.data.boardElement.data.text = "DEIN_TEXT_HIER";
  n.data.boardElement.updatedAt = new Date().toISOString();
  return { success: true, nodeId: n.id };
})()
```

## Instructions in Node schreiben (prompt-generator-Nodes)

```javascript
(function() {
  const vf = window.__SPACES_PIKASO_DEBUG__.vueflow;
  const nodes = vf.nodes?.value || vf.nodes || [];
  const n = nodes.find(n => n.id === 'NODE_ID');
  if (!n) return { success: false, error: 'Node not found' };
  if (!n.data?.boardElement?.data) return { success: false, error: 'Node has no data' };
  n.data.boardElement.data.instructions = "DEINE_INSTRUCTIONS_HIER";
  n.data.boardElement.updatedAt = new Date().toISOString();
  return { success: true, nodeId: n.id };
})()
```

## Prompt in Node schreiben (image-generator-Nodes)

```javascript
(function() {
  const vf = window.__SPACES_PIKASO_DEBUG__.vueflow;
  const nodes = vf.nodes?.value || vf.nodes || [];
  const n = nodes.find(n => n.id === 'NODE_ID');
  if (!n) return { success: false, error: 'Node not found' };
  if (!n.data?.boardElement?.data) return { success: false, error: 'Node has no data' };
  n.data.boardElement.data.prompt = "DEIN_PROMPT_HIER";
  n.data.boardElement.updatedAt = new Date().toISOString();
  return { success: true, nodeId: n.id };
})()
```

## Node ausführen (Run/Generate Button klicken)

```javascript
(function() {
  const nodeEl = document.querySelector('[data-id="NODE_ID"]');
  if (!nodeEl) return { success: false, error: 'Node element not found in DOM' };
  const buttons = nodeEl.querySelectorAll('button');
  let runBtn = null;
  for (const btn of buttons) {
    const text = btn.textContent?.toLowerCase() || '';
    if (text.includes('generate') || text.includes('run') || text.includes('upscale')) {
      runBtn = btn;
      break;
    }
  }
  if (!runBtn) {
    runBtn = nodeEl.querySelector('button[aria-label*="run"], button[aria-label*="play"], button[aria-label*="generate"]');
  }
  if (!runBtn) return { success: false, error: 'Run button not found on node' };
  if (runBtn.disabled) return { success: false, error: 'Run button is disabled (missing input?)' };
  runBtn.click();
  return { success: true, nodeId: 'NODE_ID', action: 'clicked_run_button' };
})()
```

## Node-Status prüfen (Polling)

Führe diesen Snippet alle 2-3 Sekunden aus bis `status` nicht mehr `running`, `pending` oder `queued` ist.

```javascript
(function() {
  const vf = window.__SPACES_PIKASO_DEBUG__.vueflow;
  const nodes = vf.nodes?.value || vf.nodes || [];
  const n = nodes.find(n => n.id === 'NODE_ID');
  if (!n) return { status: 'not_found' };
  return {
    nodeId: n.id,
    status: n.data?.boardElement?.workflowState?.status || 'unknown',
  };
})()
```

## Node-Output abrufen

```javascript
(function() {
  const vf = window.__SPACES_PIKASO_DEBUG__.vueflow;
  const nodes = vf.nodes?.value || vf.nodes || [];
  const n = nodes.find(n => n.id === 'NODE_ID');
  if (!n) return { error: 'Node not found' };
  const data = n.data?.boardElement?.data || {};
  const state = n.data?.boardElement?.workflowState || {};
  return {
    nodeId: n.id,
    name: n.data?.boardElement?.name,
    type: n.data?.boardElement?.type,
    status: state.status || 'unknown',
    output: data.output || null,
    generatedPrompt: data.generatedPrompt || data.generated_prompt || null,
    imageUrl: data.imageUrl || data.image_url || data.result?.url || null,
    results: data.results || null,
  };
})()
```

## Node löschen (persistiert über Liveblocks)

```javascript
(function() {
  const appEl = document.getElementById('app') || document.querySelector('[data-v-app]');
  if (!appEl?.__vue_app__) return { success: false, error: 'Vue app not found' };
  const vfs = appEl.__vue_app__.config.globalProperties.$vueFlowStorage;
  const flowId = [...vfs.flows.keys()][0];
  const fs = vfs.flows.get(flowId);
  fs.removeNodes(['NODE_ID']);
  return { success: true, persisted: true };
})()
```

## Edge (Verbindung) löschen (persistiert über Liveblocks)

```javascript
(function() {
  const appEl = document.getElementById('app') || document.querySelector('[data-v-app]');
  if (!appEl?.__vue_app__) return { success: false, error: 'Vue app not found' };
  const vfs = appEl.__vue_app__.config.globalProperties.$vueFlowStorage;
  const flowId = [...vfs.flows.keys()][0];
  const fs = vfs.flows.get(flowId);
  fs.removeEdges(['EDGE_ID']);
  return { success: true, persisted: true };
})()
```
